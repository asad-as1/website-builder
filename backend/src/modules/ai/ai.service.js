const providers = require('./providers');
const { checkRateLimit, incrementUsage } = require('./rateLimiter');
const db = require('../../shared/mongodb/mongodb.client');
const crypto = require('crypto');

// Build prompt
const buildPrompt = (userPrompt) => {
  return `
You are a senior full-stack developer. Generate a COMPLETE production-ready website with BOTH frontend and backend based on this description:

"${userPrompt}"

═══════════════════════════════════════════
TECH STACK RULES (VERY IMPORTANT):
═══════════════════════════════════════════

1. IF the user's description mentions any specific tech stack (e.g., "MERN", "Next.js", "Python Flask", "Django", "Vue", "Angular", etc.), use THAT EXACT stack.

2. IF the user did NOT mention any tech stack, use DEFAULT MERN STACK:
   BACKEND:
   - Node.js + Express.js
   - MongoDB with Mongoose
   - JWT authentication (bcryptjs for password hashing)
   - CORS, dotenv
   
   FRONTEND:
   - React 18 + Vite
   - React Router DOM v6
   - Tailwind CSS V3 (NOT V4)
   - Axios for API calls
   - Context API for state management

═══════════════════════════════════════════
FILE GENERATION RULES:
═══════════════════════════════════════════

Generate a COMPLETE project with separate frontend/ and backend/ folders.

BACKEND STRUCTURE (if MERN):
- backend/package.json
- backend/server.js
- backend/config/db.js
- backend/models/User.js, Product.js, Order.js
- backend/routes/auth.js, products.js, orders.js
- backend/middleware/auth.js
- backend/.env.example
- backend/README.md

FRONTEND STRUCTURE (if MERN):
- frontend/package.json
- frontend/vite.config.js
- frontend/tailwind.config.js
- frontend/postcss.config.js
- frontend/index.html
- frontend/src/main.jsx
- frontend/src/App.jsx
- frontend/src/index.css
- frontend/src/pages/ (Home, About, Products, ProductDetail, Cart, Checkout, Login, Register, Profile, Contact)
- frontend/src/components/ (Navbar, Footer, ProductCard, Hero, etc.)
- frontend/src/context/AuthContext.jsx, CartContext.jsx
- frontend/src/api/axios.js
- frontend/README.md

═══════════════════════════════════════════
FUNCTIONALITY REQUIREMENTS:
═══════════════════════════════════════════

- User authentication (register, login, JWT)
- Full CRUD operations for main entities
- Search and filter functionality
- Responsive design (mobile-first)
- Error handling on both frontend and backend
- Form validation
- Loading states
- Environment variables setup
- Complete API integration between frontend and backend
- README with setup instructions for both folders

═══════════════════════════════════════════
TAILWIND CSS RULES:
═══════════════════════════════════════════

- Use Tailwind CSS V3 (NOT V4)
- In package.json: "tailwindcss": "^3.4.0", "postcss": "^8.4.0", "autoprefixer": "^10.4.0"
- In CSS file use ONLY:
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
- DO NOT use @import "tailwindcss" or @theme inline (V4 syntax)

═══════════════════════════════════════════
OUTPUT FORMAT:
═══════════════════════════════════════════

Use EXACTLY this format for each file:

[FILE: backend/server.js]
<file content here>
[END_FILE]

[FILE: frontend/src/App.jsx]
<file content here>
[END_FILE]

Generate AS MANY FILES as needed to make the project COMPLETE and PRODUCTION-READY.
Do NOT limit yourself to a small number of files.

Return ONLY the files with [FILE: path] and [END_FILE] markers.
Do NOT explain your answer.
Do NOT use Markdown fences.
Use real file paths like "backend/server.js", "frontend/src/App.jsx".
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
    
    // Allow multi-level paths (backend/, frontend/, src/, etc.)
    const isValidPath =
      path !== 'path' &&
      !path.includes('..') &&
      path.length <= 200 &&
      !path.startsWith('/') &&
      /^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*\.[a-zA-Z0-9]+$/.test(path);
    
    const isReasoning = /the user said|i'll output|re-reading|must follow the format/i.test(content);

    if (!isValidPath || !content || content.length < 5 || isReasoning || seenPaths.has(path)) {
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
    if (file.path.endsWith('.css')) {
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
        max_tokens: 16000,
      });
      return response.choices[0]?.message?.content || '';
    },
  };
};

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
      
      // ✅ Updated validation — backend + frontend dono support karo
      const hasPackageJson = files.some((file) => 
        file.path === 'package.json' || 
        file.path === 'backend/package.json' ||
        file.path === 'frontend/package.json'
      );

      const hasMainFile = files.some((file) => 
        file.path === 'app/page.tsx' || 
        file.path === 'app/page.jsx' || 
        file.path === 'pages/index.tsx' || 
        file.path === 'pages/index.jsx' ||
        file.path === 'frontend/src/App.jsx' ||
        file.path === 'frontend/src/App.tsx' ||
        file.path === 'frontend/src/main.jsx' ||
        file.path === 'frontend/src/main.tsx'
      );

      if (files.length === 0 || !hasPackageJson || !hasMainFile) {
        console.log(`[AI] Validation failed. Files found: ${files.map(f => f.path).join(', ')}`);
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

const updateProjectFiles = async (userId, projectId, files, message, createVersion = true) => {
  const project = await db.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new Error('Project not found');
  if (!Array.isArray(files) || files.length === 0) throw new Error('Files are required');

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.project.update({
      where: { id: projectId },
      data: { files, updatedAt: new Date() }
    });
    
    // ✅ Only create version if createVersion is true
    if (createVersion) {
      await tx.projectVersion.create({
        data: { projectId, userId, files, message: message || 'Manual edit' }
      });
    }
    
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
  editProject,
  duplicateProject,
  getAnalytics,
  enableSharing,
  getSharedProject
};