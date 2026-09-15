const providers = require('./providers');
const { checkRateLimit, incrementUsage } = require('./rateLimiter');
const db = require('../../shared/mongodb/mongodb.client');
const crypto = require('crypto');

const exportProjectToGitHub = async (userId, projectId) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GitHub export is not configured. Add GITHUB_TOKEN to the backend environment.');

  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    select: { name: true, files: true },
  });
  if (!project) throw new Error('Project not found');

  const files = Array.isArray(project.files) ? project.files : [];
  const safeFiles = files.filter((file) => (
    file &&
    typeof file.path === 'string' &&
    typeof file.content === 'string' &&
    file.path.length <= 200 &&
    !file.path.startsWith('/') &&
    !file.path.includes('..') &&
    /^[a-zA-Z0-9_.-]+(?:\/([a-zA-Z0-9_.-]+))*\.[a-zA-Z0-9]+$/.test(file.path)
  ));
  if (!safeFiles.length || safeFiles.length !== files.length) {
    throw new Error('Project files failed GitHub export validation');
  }

  const api = process.env.GITHUB_API_URL || 'https://api.github.com';
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
  const repositoryName = `${(project.name || 'genetix-project')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'genetix-project'}-${Date.now().toString(36)}`;

  const createResponse = await fetch(`${api}/user/repos`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: repositoryName,
      description: `Website generated with Genetix: ${project.name || 'Untitled project'}`,
      private: true,
      auto_init: false,
    }),
  });
  const created = await createResponse.json();
  if (!createResponse.ok) {
    throw new Error(created.message || 'GitHub repository could not be created');
  }

  for (const file of safeFiles) {
    const uploadResponse = await fetch(`${api}/repos/${created.owner.login}/${created.name}/contents/${file.path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `Add ${file.path}`,
        content: Buffer.from(file.content, 'utf8').toString('base64'),
      }),
    });
    const uploaded = await uploadResponse.json();
    if (!uploadResponse.ok) {
      throw new Error(uploaded.message || `GitHub could not upload ${file.path}`);
    }
  }

  return { repositoryUrl: created.html_url, repositoryName };
};

// Build prompt
const buildPrompt = (userPrompt) => {
  return `
You are a full-stack developer. Generate a complete Next.js 15 + React 19 website based on this description:

"${userPrompt}"

CRITICAL INSTRUCTIONS:
1. Generate ONLY these files:
   - package.json
   - app/layout.tsx
   - app/page.tsx
   - app/globals.css
   - README.md

2. Use TAILWIND CSS V3 (NOT V4). In package.json use:
   "tailwindcss": "^3.4.0",
   "postcss": "^8.4.0",
   "autoprefixer": "^10.4.0"

3. In app/globals.css use ONLY these three lines at the top:
   @tailwind base;
   @tailwind components;
   @tailwind utilities;

4. DO NOT use:
   - @import "tailwindcss"
   - @theme inline
   - @custom-variant
   - Any V4-specific syntax

5. DO NOT add custom CSS @layer rules that might conflict.

6. Use EXACTLY this format for each file:
   [FILE: app/page.tsx]
   <file content here>
   [END_FILE]

Return ONLY the files with [FILE] and [END_FILE] markers. No extra text.
`;
};
// Parse AI response into files
const parseFiles = (text) => {
  const files = [];
  const normalizedText = text
    .replace(/```(?:json|typescript|tsx|ts|javascript|jsx|js)?/gi, '')
    .replace(/```/g, '');
  const regex = /\[FILE:\s*([^\]]+)\]\s*([\s\S]*?)\s*\[END_FILE\]/g;
  const seenPaths = new Set();
  let match;

  while ((match = regex.exec(normalizedText)) !== null) {
    const path = match[1].trim();
    const content = match[2].trim();
    const isValidPath =
      path !== 'path' &&
      !path.includes('..') &&
      /^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*\.[a-zA-Z0-9]+$/.test(path);
    const isReasoning = /the user said|i'll output|re-reading|must follow the format/i.test(content);

    if (!isValidPath || !content || isReasoning || seenPaths.has(path)) {
      continue;
    }

    seenPaths.add(path);
    files.push({
      path,
      content
    });
  }

  return files;
};

const sanitizeCss = (files) => {
  return files.map(file => {
    if (file.path === 'app/globals.css' || file.path.endsWith('.css')) {
      let content = file.content;
      
      // Remove Tailwind V4 import
      content = content.replace(/@import\s+["']tailwindcss["']\s*;/g, '');
      
      // Remove @theme inline block
      content = content.replace(/@theme\s+inline\s*\{[^}]*\}/g, '');
      
      // Remove @custom-variant
      content = content.replace(/@custom-variant[^;]*;/g, '');
      
      // Remove @plugin
      content = content.replace(/@plugin[^;]*;/g, '');
      
      // Ensure V3 directives at top
      if (!content.includes('@tailwind base')) {
        content = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n${content}`;
      }
      
      return { ...file, content: content.trim() };
    }
    return file;
  });
};

const createUserProvider = ({ provider = 'openai', apiKey }) => {
  const configs = {
    openai: { baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    groq: { baseURL: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
    openrouter: { baseURL: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
    deepseek: { baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  };
  if (provider === 'gemini') {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const client = new GoogleGenerativeAI(apiKey);
    return {
      name: 'gemini (your key)',
      client,
      generate: async (activeClient, prompt) => {
        const model = activeClient.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const response = await model.generateContent(prompt);
        return response.response.text();
      },
    };
  }
  const config = configs[provider];
  if (!config) throw new Error('Unsupported AI provider. Choose Gemini, OpenAI, Groq, OpenRouter, or DeepSeek.');
  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey, baseURL: config.baseURL });
  return {
    name: `${provider} (your key)`,
    client,
    generate: async (activeClient, prompt) => {
      const response = await activeClient.chat.completions.create({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4096,
      });
      return response.choices[0]?.message?.content || '';
    },
  };
};

// Generate website with fallback
// Generate website with fallback
const generateWebsite = async (userId, userPrompt, userProvider) => {
  // Check rate limit
  const rateCheck = await checkRateLimit(userId);
  if (!rateCheck.allowed) {
    throw new Error(rateCheck.message);
  }

  const prompt = buildPrompt(userPrompt);
  let lastError = null;

  const activeProviders = userProvider?.apiKey
    ? [createUserProvider(userProvider)]
    : providers;
  for (const provider of activeProviders) {
    console.log(`[AI] Trying provider: ${provider.name}${provider.model ? ` (${provider.model})` : ''}`);
    try {
      const code = await provider.generate(provider.client, prompt);
      if (typeof code !== 'string' || !code.trim()) {
        throw new Error('Provider returned an empty response');
      }
      
      // Parse files
      let files = parseFiles(code);
      files = sanitizeCss(files);  
      
      if (
        files.length === 0 ||
        !files.some((file) => file.path === 'package.json') ||
        !files.some((file) => file.path === 'app/page.tsx' || file.path === 'app/page.jsx' || file.path === 'pages/index.tsx' || file.path === 'pages/index.jsx')
      ) {
        throw new Error('Provider returned an invalid website structure');
      }

      await incrementUsage(userId);

      console.log(`[AI] Provider succeeded: ${provider.name}${provider.model ? ` (${provider.model})` : ''}`);
      return {
        provider: provider.name,
        files,
        prompt: userPrompt,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.log(`[AI] Provider failed: ${provider.name} - ${error instanceof Error ? error.message : 'Unknown provider error'}`);
      lastError = error;
      continue;
    }
  }

  if (userProvider?.apiKey && lastError) {
    const providerMessage = lastError.message || 'The provider rejected the request.';
    throw new Error(`Your ${userProvider.provider || 'AI'} key could not generate this project: ${providerMessage}`);
  }
  throw new Error('All configured AI providers failed. Please try again in a moment.');
};

// Save project
const saveProject = async (userId, name, prompt, files) => {
  const thumbnail = makeThumbnail(name || prompt);
  const project = await db.project.create({
    data: {
      userId,
      name: name || prompt.substring(0, 50),
      prompt,
      files: files,
      thumbnail,
      status: 'completed'
    },
    include: { versions: true }
  });

  await db.projectVersion.create({
    data: {
      projectId: project.id,
      userId,
      files,
      message: 'Initial generation'
    }
  });

  return project;
};

const makeThumbnail = (value = 'Project') => {
  const palettes = [
    'from-cyan-500/30 to-blue-600/30',
    'from-fuchsia-500/30 to-purple-600/30',
    'from-emerald-500/30 to-teal-600/30',
    'from-amber-500/30 to-rose-600/30',
  ];
  const emojis = ['✦', '◈', '◉', '⬢', '✺', '✧'];
  const hash = [...String(value)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return { emoji: emojis[hash % emojis.length], gradient: palettes[hash % palettes.length] };
};

const duplicateProject = async (userId, projectId) => {
  const source = await db.project.findFirst({ where: { id: projectId, userId } });
  if (!source) throw new Error('Project not found');
  const name = `${source.name || 'Project'} Copy`;
  const duplicate = await db.project.create({
    data: {
      userId,
      name,
      prompt: source.prompt,
      files: source.files,
      thumbnail: makeThumbnail(name),
      status: source.status || 'draft',
    },
  });
  await db.projectVersion.create({
    data: { projectId: duplicate.id, userId, files: duplicate.files, message: 'Duplicated project' },
  });
  return getProject(userId, duplicate.id);
};

const getAnalytics = async (userId) => {
  const [projects, user] = await Promise.all([
    db.project.findMany({ where: { userId }, select: { id: true, name: true, createdAt: true, updatedAt: true, files: true } }),
    db.user.findUnique({ where: { id: userId }, select: { apiUsage: true, previewUsage: true } }),
  ]);
  const versions = await db.projectVersion.findMany({ where: { userId }, select: { createdAt: true } });
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const label = date.toLocaleDateString('en-US', { weekday: 'short' });
    return {
      label,
      projects: projects.filter((item) => new Date(item.createdAt) >= date && new Date(item.createdAt) < next).length,
      edits: versions.filter((item) => new Date(item.createdAt) >= date && new Date(item.createdAt) < next).length,
    };
  });
  return {
    totals: { projects: projects.length, files: projects.reduce((sum, item) => sum + (Array.isArray(item.files) ? item.files.length : 0), 0), versions: versions.length, aiRequests: user?.apiUsage || 0, previews: user?.previewUsage || 0 },
    days,
  };
};

const enableSharing = async (userId, projectId) => {
  const project = await db.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new Error('Project not found');
  const shareToken = project.shareToken || crypto.randomBytes(24).toString('hex');
  return db.project.update({ where: { id: projectId }, data: { shareToken, shareEnabled: true } });
};

const getSharedProject = async (shareToken) => {
  const project = await db.project.findFirst({ where: { shareToken, shareEnabled: true }, select: { name: true, prompt: true, files: true, thumbnail: true, updatedAt: true } });
  if (!project) throw new Error('Shared project not found');
  return project;
};

const getProject = async (userId, projectId) => {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    include: { versions: { orderBy: { createdAt: 'desc' } } }
  });
  if (!project) throw new Error('Project not found');
  return project;
};

const projectSlug = (name) => name
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'project';

const getProjectBySlug = async (userId, slug) => {
  const projects = await db.project.findMany({
    where: { userId },
    include: { versions: { orderBy: { createdAt: 'desc' } } },
    orderBy: { createdAt: 'desc' }
  });
  const project = projects.find((item) => projectSlug(item.name) === slug);
  if (!project) throw new Error('Project not found');
  return project;
};

const deleteProject = async (userId, projectId) => {
  const project = await db.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new Error('Project not found');
  await db.projectVersion.deleteMany({ where: { projectId, userId } });
  await db.project.delete({ where: { id: projectId } });
};

const deleteProjectVersion = async (userId, projectId, versionId) => {
  const version = await db.projectVersion.findFirst({ where: { id: versionId, projectId, userId } });
  if (!version) throw new Error('Version not found');
  await db.projectVersion.delete({ where: { id: versionId } });
};

const updateProjectFiles = async (userId, projectId, files, message) => {
  const project = await db.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new Error('Project not found');
  if (!Array.isArray(files) || files.length === 0) throw new Error('Files are required');

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.project.update({
      where: { id: projectId },
      data: { files, updatedAt: new Date() }
    });
    await tx.projectVersion.create({
      data: { projectId, userId, files, message: message || 'Manual edit' }
    });
    return result;
  });
  return getProject(userId, projectId);
};

const rollbackProject = async (userId, projectId, versionId) => {
  const version = await db.projectVersion.findFirst({
    where: { id: versionId, projectId, userId }
  });
  if (!version) throw new Error('Version not found');
  return updateProjectFiles(userId, projectId, version.files, 'Rollback');
};

const editProject = async (userId, projectId, instruction, selectedPaths) => {
  const project = await db.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new Error('Project not found');
  if (!instruction || instruction.trim().length < 5) throw new Error('Edit instruction is too short');

  const files = Array.isArray(project.files) ? project.files : [];
  const selected = Array.isArray(selectedPaths) && selectedPaths.length
    ? files.filter((file) => selectedPaths.includes(file.path))
    : files.slice(0, 8);
  if (!selected.length) throw new Error('No files selected for editing');

  const editPrompt = `
You are editing an existing website. Apply this requested change:
"${instruction}"

Return ONLY changed files using exact markers [FILE: real/path.ext] and [END_FILE].
Do not explain your answer or use Markdown fences. Preserve unrelated behavior.

Existing files:
${selected.map((file) => `\n[FILE: ${file.path}]\n${file.content}\n[END_FILE]`).join('\n')}
`;

  for (const provider of providers) {
    console.log(`[AI Edit] Trying provider: ${provider.name}${provider.model ? ` (${provider.model})` : ''}`);
    try {
      const response = await provider.generate(provider.client, editPrompt);
      if (typeof response !== 'string' || !response.trim()) throw new Error('Empty response');
      const changedFiles = parseFiles(response);
      if (!changedFiles.length) throw new Error('No valid files returned');
      const changedByPath = new Map(changedFiles.map((file) => [file.path, file]));
      const updatedFiles = files.map((file) => changedByPath.get(file.path) || file);
      console.log(`[AI Edit] Provider succeeded: ${provider.name}${provider.model ? ` (${provider.model})` : ''}`);
      return updateProjectFiles(userId, projectId, updatedFiles, `AI edit: ${instruction}`);
    } catch (error) {
      console.log(`[AI Edit] Provider failed: ${provider.name} - ${error instanceof Error ? error.message : 'Unknown provider error'}`);
    }
  }
  throw new Error('All AI providers failed to edit the project');
};

module.exports = {
  generateWebsite,
  saveProject,
  getProject,
  getProjectBySlug,
  deleteProject,
  deleteProjectVersion,
  updateProjectFiles,
  rollbackProject,
  editProject
  ,duplicateProject
  ,getAnalytics
  ,enableSharing
  ,getSharedProject
  ,exportProjectToGitHub
};