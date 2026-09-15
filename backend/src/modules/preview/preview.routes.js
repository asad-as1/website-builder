const router = require('express').Router();
const { Sandbox } = require('e2b');
const { authenticate } = require('../auth/auth.middleware');
const db = require('../../shared/mongodb/mongodb.client');
const path = require('path');
const { checkPreviewLimit, incrementPreviewUsage } = require('../ai/rateLimiter');
const E2B_PROJECT_DIR = '/home/user';
const E2B_PREVIEW_PORT = 3000;
const E2B_COMMAND_TIMEOUT_MS = 8 * 60 * 1000;
const E2B_DEV_SERVER_TIMEOUT_MS = 8 * 60 * 1000;

const runE2BCommand = async (sandbox, command, options = {}) => {
  const result = await sandbox.commands.run(command, {
    ...options,
    timeoutMs: E2B_COMMAND_TIMEOUT_MS,
    requestTimeoutMs: E2B_COMMAND_TIMEOUT_MS + 60 * 1000,
  });

  if (result.exitCode !== 0) {
    const output = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    throw new Error(`${command} failed (exit code ${result.exitCode}): ${output || 'no command output'}`);
  }

  return result;
};

const validFile = (file) => (
  file &&
  typeof file.path === 'string' &&
  typeof file.content === 'string' &&
  !file.path.startsWith('/') &&
  !file.path.includes('..') &&
  /^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*\.[a-zA-Z0-9]+$/.test(file.path)
);

// Parses the actual major version out of a semver-ish range string
// (e.g. "^4.1.13", "~3.4.0", "4.0.3") instead of naively checking
// whether the digit "3" appears anywhere in the string, which
// misclassifies Tailwind v4 patch releases like "4.0.3" or "4.1.13"
// as v3.
const getTailwindMajorVersion = (packageJson) => {
  const versionStr =
    packageJson.dependencies?.tailwindcss ||
    packageJson.devDependencies?.tailwindcss ||
    '';
  if (!versionStr) return null;
  const match = versionStr.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
};

const savePreviewThumbnail = async (projectId, previewUrl) => {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { thumbnail: true } });
  await db.project.update({
    where: { id: projectId },
    data: {
      previewUrl,
      thumbnail: { ...(project?.thumbnail || {}), previewUrl },
    },
  });
};

router.post('/:projectId', authenticate, async (req, res) => {
  let sandbox;
  let files = [];
  let previewLimit;
  try {
    console.log(`[Preview] Request started for project ${req.params.projectId}`);
    if (!process.env.E2B_API_KEY || process.env.E2B_API_KEY === 'your-e2b-api-key') {
      console.log('[Preview] E2B credentials are not configured');
      return res.status(503).json({ error: 'Preview is not configured. Add E2B_API_KEY to the backend environment.' });
    }
    console.log('[Preview] Checking preview usage limit');
    previewLimit = await checkPreviewLimit(req.userId);
    console.log(`[Preview] Preview limit checked: allowed=${previewLimit.allowed}`);
    if (!previewLimit.allowed) return res.status(429).json({ error: previewLimit.message });
    const project = await db.project.findFirst({
      where: { id: req.params.projectId, userId: req.userId },
      select: { files: true },
    });
    console.log(`[Preview] Project loaded: ${Boolean(project)}`);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    files = Array.isArray(project.files) ? project.files : [];
    console.log(`[Preview] Validating ${files.length} project files`);
    if (!files.length || files.length > 100 || files.some((file) => !validFile(file))) {
      return res.status(400).json({ error: 'Project files failed preview validation' });
    }
    const packageFile = files.find((file) => file.path === 'package.json');
    const postcssFile = files.find((file) => file.path === 'postcss.config.js' || file.path === 'postcss.config.mjs');
    if (!packageFile) {
      return res.status(400).json({ error: 'Generated project is missing package.json' });
    }
    console.log('[Preview] package.json found');
    let packageJson;
    try {
      packageJson = JSON.parse(packageFile.content);
    } catch {
      return res.status(400).json({ error: 'Generated project has an invalid package.json' });
    }
    if (!packageJson.scripts || typeof packageJson.scripts.dev !== 'string') {
      return res.status(400).json({ error: 'Generated project has no dev script' });
    }
    console.log(`[Preview] Project dev script: ${packageJson.scripts.dev}`);

    // Only rewrite @import "tailwindcss"; -> @tailwind base/components/utilities;
    // for genuine Tailwind v3 (or no declared tailwindcss dependency at all).
    // Substring-matching on "3" previously misclassified v4 patch releases
    // such as "^4.0.3" or "~4.1.13" as v3, which corrupted valid v4 CSS and
    // caused PostCSS compile failures.
    const tailwindMajor = getTailwindMajorVersion(packageJson);
    const usesTailwindV3 = tailwindMajor === null || tailwindMajor < 4;
    const hasNextConfig = files.some((file) => /^next\.config\.(js|mjs|ts)$/.test(file.path));

    console.log(`[Preview] Tailwind major version detected: ${tailwindMajor ?? 'none declared'} (treating as v3 rewrite: ${usesTailwindV3})`);
    console.log('[Preview] Trying E2B');
    // The base E2B SDK sandbox is a general Linux/Node runtime. The
    // code-interpreter template is for Python execution and cannot reliably
    // serve a generated Next.js application.
    sandbox = await Sandbox.create(process.env.E2B_TEMPLATE_ID || 'base', {
      apiKey: process.env.E2B_API_KEY,
      timeoutMs: 30 * 60 * 1000,
      network: { allowPublicTraffic: true },
    });
    console.log(`[Preview] E2B sandbox created: ${sandbox.sandboxId}`);
    // Create the working directory before using it as the command cwd.
    await runE2BCommand(sandbox, 'mkdir -p /home/user');
    const commandOptions = { cwd: E2B_PROJECT_DIR };
    for (const file of files) {
      const content = usesTailwindV3 && file.path === 'app/globals.css'
        ? file.content
          .replace(/@import\s+["']tailwindcss["']\s*;/g, '@tailwind base;\n@tailwind components;\n@tailwind utilities;')
          .replace(/@tailwindcss\s+(base|components|utilities)\s*;/g, '@tailwind $1;')
        : file.content;
      const destination = path.posix.join(E2B_PROJECT_DIR, file.path);
      await runE2BCommand(sandbox, `mkdir -p ${JSON.stringify(path.posix.dirname(destination))}`, commandOptions);
      await sandbox.files.write(destination, content);
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
    console.log('[Preview] Project files uploaded');
    if (postcssFile?.content.includes('autoprefixer')) {
      console.log('[Preview] Installing autoprefixer');
      await runE2BCommand(sandbox, 'npm install --no-save --no-audit --no-fund autoprefixer', commandOptions);
    }
    console.log('[Preview] Installing project dependencies');
    await runE2BCommand(sandbox, 'npm install --no-audit --no-fund', commandOptions);
    console.log('[Preview] Starting Next.js server');
    // NOTE: timeoutMs is set explicitly here (unlike relying on SDK defaults)
    // because this is a long-lived background process, not a one-shot
    // command. Without it, the sandbox could kill the dev server shortly
    // after start on some SDK versions whose default command timeout is
    // much shorter than the time Next.js needs to stay alive.
    await sandbox.commands.run(
      `npm run dev -- --hostname 0.0.0.0 --port ${E2B_PREVIEW_PORT} > /tmp/genetix.log 2>&1`,
      {
        ...commandOptions,
        background: true,
        timeoutMs: E2B_DEV_SERVER_TIMEOUT_MS,
        requestTimeoutMs: 60 * 1000,
      },
    );
    console.log('[Preview] Waiting for Next.js server');
    await runE2BCommand(
      sandbox,
      'for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 43 44 45; do curl -fsS http://127.0.0.1:3000 >/dev/null && exit 0; sleep 1; done; printf "\\n--- Next.js runtime log ---\\n"; cat /tmp/genetix.log 2>/dev/null || true; exit 1',
      commandOptions
    );
    await incrementPreviewUsage(req.userId);
    const host = sandbox.getHost(E2B_PREVIEW_PORT);
    const previewUrl = /^https?:\/\//i.test(host) ? host : `https://${host}`;
    console.log('[Preview] E2B succeeded');
    await savePreviewThumbnail(req.params.projectId, `${previewUrl}?preview=${Date.now()}`);
    res.json({ previewUrl: `${previewUrl}?preview=${Date.now()}`, expiresInMinutes: 15, remaining: previewLimit.remaining - 1 });
  } catch (error) {
    console.log(`[Preview] E2B failed: ${error instanceof Error ? error.message : 'Unknown E2B error'}`);
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
    // Always log the raw details server-side, even when there's no runtime
    // log, so failures can actually be diagnosed instead of only seeing the
    // generic "friendly" message.
    console.log(`[Preview] Raw failure details:\n${rawDetails.trim() || '(no details captured)'}`);
    let friendly = 'The generated project could not start. Please try generating it again.';
    if (/globals\.css|SyntaxError|postcss|tailwind/i.test(rawDetails)) {
      friendly = 'Preview could not compile the generated styles. Try generating again, or remove advanced CSS directives from the project.';
    } else if (/npm install|lockfile|dependencies/i.test(rawDetails)) {
      friendly = 'Preview dependencies could not be installed in the sandbox. Please try again in a moment.';
    } else if (/timeout|deadline/i.test(rawDetails)) {
      friendly = 'Preview took too long to start. Please try again.';
    }
    console.log(`[Preview] Sending failure response: ${friendly}`);
    res.status(502).json({ error: friendly });
  }
});

module.exports = router;