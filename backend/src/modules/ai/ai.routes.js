const router = require('express').Router();
const aiService = require('./ai.service');
const { authenticate } = require('../auth/auth.middleware');
const db = require('../../shared/mongodb/mongodb.client');
const archiverModule = require('archiver');

// Generate website
router.post('/generate', authenticate, async (req, res) => {
  try {
    const { prompt, aiProvider, aiApiKey } = req.body;
    const userId = req.userId;

    if (!prompt || prompt.trim().length < 5) {
      return res.status(400).json({ 
        error: 'Please provide a detailed description of your website (min 5 characters).' 
      });
    }

    if (prompt.length > 1500) {
      return res.status(400).json({ 
        error: 'Please keep your description under 1500 characters.' 
      });
    }

    const result = await aiService.generateWebsite(
      userId,
      prompt,
      aiApiKey ? { provider: aiProvider, apiKey: aiApiKey } : undefined,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Generation failed' });
  }
});

// Save project
router.post('/save', authenticate, async (req, res) => {
  try {
    const { name, prompt, files } = req.body;
    const userId = req.userId;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files to save' });
    }

    const project = await aiService.saveProject(userId, name, prompt, files);
    res.json({ 
      message: 'Project saved successfully!', 
      project 
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to save project' });
  }
});

// List projects
router.get('/projects', authenticate, async (req, res) => {
  try {
    const userId = req.userId;
    const projects = await db.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prompt: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        thumbnail: true
      }
    });

    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

router.post('/projects/:projectId/duplicate', authenticate, async (req, res) => {
  try {
    const project = await aiService.duplicateProject(req.userId, req.params.projectId);
    res.status(201).json({ project });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.get('/analytics', authenticate, async (req, res) => {
  try {
    res.json({ analytics: await aiService.getAnalytics(req.userId) });
  } catch (error) {
    res.status(500).json({ error: 'Analytics could not be loaded' });
  }
});

router.post('/projects/:projectId/share', authenticate, async (req, res) => {
  try {
    const project = await aiService.enableSharing(req.userId, req.params.projectId);
    res.json({ shareToken: project.shareToken });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.get('/shared/:shareToken', async (req, res) => {
  try {
    res.json({ project: await aiService.getSharedProject(req.params.shareToken) });
  } catch (error) {
    res.status(404).json({ error: 'Shared project not found' });
  }
});

// Get a single project (ownership enforced in service)
router.get('/projects/:projectId', authenticate, async (req, res) => {
  try {
    const project = await aiService.getProject(req.userId, req.params.projectId);
    res.json({ project });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.get('/projects/by-slug/:slug', authenticate, async (req, res) => {
  try {
    const project = await aiService.getProjectBySlug(req.userId, req.params.slug);
    res.json({ project });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.delete('/projects/:projectId', authenticate, async (req, res) => {
  try {
    await aiService.deleteProject(req.userId, req.params.projectId);
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Update files and create a new version
router.put('/projects/:projectId/files', authenticate, async (req, res) => {
  try {
    const { files, message } = req.body;
    const project = await aiService.updateProjectFiles(
      req.userId,
      req.params.projectId,
      files,
      message
    );
    res.json({ project });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Rollback to a specific version
router.post('/projects/:projectId/rollback/:versionId', authenticate, async (req, res) => {
  try {
    const project = await aiService.rollbackProject(
      req.userId,
      req.params.projectId,
      req.params.versionId
    );
    res.json({ project });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/projects/:projectId/versions/:versionId', authenticate, async (req, res) => {
  try {
    await aiService.deleteProjectVersion(req.userId, req.params.projectId, req.params.versionId);
    res.json({ message: 'Version deleted successfully' });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// AI-powered targeted edit
router.post('/projects/:projectId/edit', authenticate, async (req, res) => {
  try {
    const { instruction, selectedPaths } = req.body;
    const project = await aiService.editProject(
      req.userId,
      req.params.projectId,
      instruction,
      selectedPaths
    );
    res.json({ project });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Secure ZIP export
router.get('/projects/:projectId/download', authenticate, async (req, res) => {
  try {
    const project = await db.project.findFirst({
      where: { id: req.params.projectId, userId: req.userId },
      select: { name: true, files: true }
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const files = Array.isArray(project.files) ? project.files : [];
    if (files.length === 0 || files.length > 100) {
      return res.status(400).json({ error: 'Project has an invalid file count' });
    }

    const safeFiles = files.filter((file) => (
      file &&
      typeof file.path === 'string' &&
      typeof file.content === 'string' &&
      file.path.length <= 200 &&
      !file.path.startsWith('/') &&
      !file.path.includes('..') &&
      /^[a-zA-Z0-9_.-]+(?:\/([a-zA-Z0-9_.-]+))*\.[a-zA-Z0-9]+$/.test(file.path)
    ));
    const totalBytes = safeFiles.reduce((total, file) => total + Buffer.byteLength(file.content, 'utf8'), 0);
    if (safeFiles.length !== files.length || totalBytes > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'Project files failed safety validation' });
    }

    const archive = new archiverModule.ZipArchive({ zlib: { level: 9 } });
    archive.on('error', (error) => {
      if (!res.headersSent) res.status(500).json({ error: `Failed to create ZIP: ${error.message}` });
      else res.destroy(error);
    });
    res.attachment(`${project.name.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60) || 'project'}.zip`);
    archive.pipe(res);
    for (const file of safeFiles) archive.append(file.content, { name: file.path });
    await archive.finalize();
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: `Failed to create ZIP: ${error.message}` });
  }
});

// router.post('/projects/:projectId/github-export', authenticate, async (req, res) => {
//   try {
//     const result = await aiService.exportProjectToGitHub(req.userId, req.params.projectId);
//     res.json(result);
//   } catch (error) {
//     res.status(400).json({ error: error.message || 'GitHub export failed' });
//   }
// });

module.exports = router;
