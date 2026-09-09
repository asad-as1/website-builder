const providers = require('./providers');
const { checkRateLimit, incrementUsage } = require('./rateLimiter');
const prisma = require('../../shared/prisma/prisma.client');

// Build prompt
const buildPrompt = (userPrompt) => {
  return `
You are a full-stack developer. Generate a complete Next.js 15 + React 19 website based on this description:

"${userPrompt}"

Return ONLY the files in this EXACT format. Do not explain your answer, repeat these instructions, or use Markdown fences:

[FILE: package.json]
{
  "name": "my-app",
  "version": "1.0.0",
  ...
}
[END_FILE]

[FILE: app/page.tsx]
import ...
export default function Home() { ... }
[END_FILE]

[FILE: app/layout.tsx]
...
[END_FILE]

[FILE: README.md]
# My App
...
[END_FILE]

Make it production-ready with:
- Next.js 15 + React 19
- TypeScript
- Tailwind CSS
- Proper folder structure
- Error handling

ONLY return files with [FILE: path] and [END_FILE] markers. Use real paths such as app/page.tsx; never use the literal placeholder path.
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

// Generate website with fallback
const generateWebsite = async (userId, userPrompt) => {
  // Check rate limit
  const rateCheck = await checkRateLimit(userId);
  if (!rateCheck.allowed) {
    throw new Error(rateCheck.message);
  }

  const prompt = buildPrompt(userPrompt);
  let lastError = null;

  for (const provider of providers) {
    try {
      console.log(`🔄 Trying ${provider.name}...`);
      const code = await provider.generate(provider.client, prompt);
      if (typeof code !== 'string' || !code.trim()) {
        throw new Error('Provider returned an empty response');
      }
      
      // Increment usage
      await incrementUsage(userId);
      
      // Parse files
      const files = parseFiles(code);
      
      if (files.length === 0) {
        throw new Error('No files generated');
      }

      console.log(`✅ ${provider.name} generated ${files.length} files`);

      return {
        provider: provider.name,
        files,
        prompt: userPrompt,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ ${provider.name} failed:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw new Error('All AI providers are currently busy. Please try again in 5 minutes.');
};

// Save project
const saveProject = async (userId, name, prompt, files) => {
  const project = await prisma.project.create({
    data: {
      userId,
      name: name || prompt.substring(0, 50),
      prompt,
      files: files,
      status: 'completed'
    },
    include: { versions: true }
  });

  await prisma.projectVersion.create({
    data: {
      projectId: project.id,
      userId,
      files,
      message: 'Initial generation'
    }
  });

  return project;
};

const getProject = async (userId, projectId) => {
  const project = await prisma.project.findFirst({
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
  const projects = await prisma.project.findMany({
    where: { userId },
    include: { versions: { orderBy: { createdAt: 'desc' } } },
    orderBy: { createdAt: 'desc' }
  });
  const project = projects.find((item) => projectSlug(item.name) === slug);
  if (!project) throw new Error('Project not found');
  return project;
};

const updateProjectFiles = async (userId, projectId, files, message) => {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new Error('Project not found');
  if (!Array.isArray(files) || files.length === 0) throw new Error('Files are required');

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.project.update({
      where: { id: projectId },
      data: { files, updatedAt: new Date() }
    });
    await tx.projectVersion.create({
      data: { projectId, userId, files, message: message || 'Manual edit' }
    });
    return result;
  });
  return updated;
};

const rollbackProject = async (userId, projectId, versionId) => {
  const version = await prisma.projectVersion.findFirst({
    where: { id: versionId, projectId, userId }
  });
  if (!version) throw new Error('Version not found');
  return updateProjectFiles(userId, projectId, version.files, 'Rollback');
};

const editProject = async (userId, projectId, instruction, selectedPaths) => {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
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
    try {
      const response = await provider.generate(provider.client, editPrompt);
      if (typeof response !== 'string' || !response.trim()) throw new Error('Empty response');
      const changedFiles = parseFiles(response);
      if (!changedFiles.length) throw new Error('No valid files returned');
      const changedByPath = new Map(changedFiles.map((file) => [file.path, file]));
      const updatedFiles = files.map((file) => changedByPath.get(file.path) || file);
      return updateProjectFiles(userId, projectId, updatedFiles, `AI edit: ${instruction}`);
    } catch (error) {
      console.error(`Edit provider ${provider.name} failed:`, error.message);
    }
  }
  throw new Error('All AI providers failed to edit the project');
};

module.exports = {
  generateWebsite,
  saveProject,
  getProject,
  getProjectBySlug,
  updateProjectFiles,
  rollbackProject,
  editProject
};