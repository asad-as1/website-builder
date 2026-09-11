const router = require('express').Router();
const { Sandbox } = require('@e2b/code-interpreter');
const { authenticate } = require('../auth/auth.middleware');
const db = require('../../shared/mongodb/mongodb.client');
const path = require('path');
const { checkPreviewLimit, incrementPreviewUsage } = require('../ai/rateLimiter');

const validFile = (file) => (
  file &&
  typeof file.path === 'string' &&
  typeof file.content === 'string' &&
  !file.path.startsWith('/') &&
  !file.path.includes('..') &&
  /^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*\.[a-zA-Z0-9]+$/.test(file.path)
);

router.post('/:projectId', authenticate, async (req, res) => {
  let sandbox;
  try {
    if (!process.env.E2B_API_KEY || process.env.E2B_API_KEY === 'your-e2b-api-key') {
      return res.status(503).json({ error: 'Preview is not configured. Add E2B_API_KEY to the backend environment.' });
    }
    const previewLimit = await checkPreviewLimit(req.userId);
    if (!previewLimit.allowed) return res.status(429).json({ error: previewLimit.message });
    const project = await db.project.findFirst({
      where: { id: req.params.projectId, userId: req.userId },
      select: { files: true },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const files = Array.isArray(project.files) ? project.files : [];
    if (!files.length || files.length > 100 || files.some((file) => !validFile(file))) {
      return res.status(400).json({ error: 'Project files failed preview validation' });
    }
    const packageFile = files.find((file) => file.path === 'package.json');
    const postcssFile = files.find((file) => file.path === 'postcss.config.js' || file.path === 'postcss.config.mjs');
    if (!packageFile) {
      return res.status(400).json({ error: 'Generated project is missing package.json' });
    }
    let packageJson;
    try {
      packageJson = JSON.parse(packageFile.content);
    } catch {
      return res.status(400).json({ error: 'Generated project has an invalid package.json' });
    }
    if (!packageJson.scripts || typeof packageJson.scripts.dev !== 'string') {
      return res.status(400).json({ error: 'Generated project has no dev script' });
    }
    const tailwindVersion = `${packageJson.dependencies?.tailwindcss || ''}${packageJson.devDependencies?.tailwindcss || ''}`;
    const usesTailwindV3 = tailwindVersion.includes('3') || !tailwindVersion;
    const hasNextConfig = files.some((file) => /^next\.config\.(js|mjs|ts)$/.test(file.path));

    sandbox = await Sandbox.create({
      apiKey: process.env.E2B_API_KEY,
      timeoutMs: 30 * 60 * 1000,
    });
    const commandOptions = { timeoutMs: 10 * 60 * 1000, requestTimeoutMs: 10 * 60 * 1000 };
    await sandbox.commands.run('rm -rf /home/user/* /home/user/.[!.]*', commandOptions);
    for (const file of files) {
      const content = usesTailwindV3 && file.path === 'app/globals.css'
        ? file.content
          .replace(/@import\s+["']tailwindcss["']\s*;/g, '@tailwind base;\n@tailwind components;\n@tailwind utilities;')
          .replace(/@tailwindcss\s+(base|components|utilities)\s*;/g, '@tailwind $1;')
        : file.content;
      await sandbox.files.write(path.posix.join('/home/user', file.path), content);
    }
    if (!hasNextConfig) {
      await sandbox.files.write(
        '/home/user/next.config.js',
        `/** Preview compatibility config for remote portfolio images. */
module.exports = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' }
    ]
  }
};`
      );
    }
    if (postcssFile?.content.includes('autoprefixer')) {
      await sandbox.commands.run('cd /home/user && npm install --no-save --no-audit --no-fund autoprefixer', commandOptions);
    }
    await sandbox.commands.run('cd /home/user && npm install --no-audit --no-fund', commandOptions);
    await sandbox.commands.run(
      'cd /home/user && (nohup npm run dev -- --hostname 0.0.0.0 --port 3000 > /tmp/genetix.log 2>&1 </dev/null &)',
      commandOptions
    );
    await sandbox.commands.run(
      'for i in 1 2 3 4 5 6 7 8 9 10; do curl -fsS http://127.0.0.1:3000 >/dev/null && exit 0; sleep 1; done; cat /tmp/genetix.log; exit 1',
      commandOptions
    );
    await incrementPreviewUsage(req.userId);
    const host = sandbox.getHost(3000);
    const previewUrl = /^https?:\/\//i.test(host) ? host : `https://${host}`;
    res.json({ previewUrl: `${previewUrl}?preview=${Date.now()}`, expiresInMinutes: 15 });
  } catch (error) {
    let runtimeLog = '';
    if (sandbox) {
      try {
        runtimeLog = await sandbox.files.read('/tmp/genetix.log');
      } catch {
        runtimeLog = '';
      }
    }
    if (sandbox) await sandbox.kill().catch(() => undefined);
    const rawDetails = `${error.message || ''} ${runtimeLog}`;
    let friendly = 'The generated project could not start. Please try generating it again.';
    if (/globals\.css|SyntaxError|postcss|tailwind/i.test(rawDetails)) {
      friendly = 'Preview could not compile the generated styles. Try generating again, or remove advanced CSS directives from the project.';
    } else if (/npm install|lockfile|dependencies/i.test(rawDetails)) {
      friendly = 'Preview dependencies could not be installed in the sandbox. Please try again in a moment.';
    } else if (/timeout|deadline/i.test(rawDetails)) {
      friendly = 'Preview took too long to start. Please try again.';
    }
    res.status(502).json({ error: friendly });
  }
});

module.exports = router;
