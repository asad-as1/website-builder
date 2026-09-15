const router = require("express").Router();
const { Sandbox } = require("e2b");
const { authenticate } = require("../auth/auth.middleware");
const db = require("../../shared/mongodb/mongodb.client");
const path = require("path");
const {
  checkPreviewLimit,
  incrementPreviewUsage,
} = require("../ai/rateLimiter");
const E2B_PROJECT_DIR = "/home/user";
const E2B_PREVIEW_PORT = 3000;
const E2B_COMMAND_TIMEOUT_MS = 8 * 60 * 1000;
const E2B_DEV_SERVER_TIMEOUT_MS = 8 * 60 * 1000;

// Known optional Tailwind plugins that generated tailwind.config.js files
// sometimes require() without declaring as a real dependency.
const KNOWN_TAILWIND_PLUGINS = [
  "@tailwindcss/typography",
  "@tailwindcss/forms",
  "@tailwindcss/aspect-ratio",
  "@tailwindcss/container-queries",
];

const runE2BCommand = async (sandbox, command, options = {}) => {
  const result = await sandbox.commands.run(command, {
    ...options,
    timeoutMs: E2B_COMMAND_TIMEOUT_MS,
    requestTimeoutMs: E2B_COMMAND_TIMEOUT_MS + 60 * 1000,
  });

  if (result.exitCode !== 0) {
    const output = [result.stderr, result.stdout]
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(
      `${command} failed (exit code ${result.exitCode}): ${output || "no command output"}`,
    );
  }

  return result;
};

const validFile = (file) =>
  file &&
  typeof file.path === "string" &&
  typeof file.content === "string" &&
  !file.path.startsWith("/") &&
  !file.path.includes("..") &&
  /^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*\.[a-zA-Z0-9]+$/.test(file.path);

const getTailwindMajorVersion = (packageJson) => {
  const versionStr =
    packageJson.dependencies?.tailwindcss ||
    packageJson.devDependencies?.tailwindcss ||
    "";
  if (!versionStr) return null;
  const match = versionStr.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
};

// ✅ Detect Tailwind plugins referenced in the config but missing from package.json
const getMissingTailwindPlugins = (tailwindConfigFile, packageJson) => {
  if (!tailwindConfigFile) return [];
  return KNOWN_TAILWIND_PLUGINS.filter(
    (pkg) =>
      tailwindConfigFile.content.includes(pkg) &&
      !packageJson.dependencies?.[pkg] &&
      !packageJson.devDependencies?.[pkg],
  );
};

const savePreviewThumbnail = async (projectId, previewUrl) => {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { thumbnail: true },
  });
  await db.project.update({
    where: { id: projectId },
    data: {
      previewUrl,
      thumbnail: { ...(project?.thumbnail || {}), previewUrl },
    },
  });
};

// ✅ Detect framework type from package.json
const detectFramework = (packageJson) => {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  if (deps.next) return { name: "Next.js", hostFlag: "--hostname" };
  if (deps.vite) return { name: "Vite", hostFlag: "--host" };
  if (deps["react-scripts"]) return { name: "CRA", hostFlag: "--host" };
  if (deps.nuxt) return { name: "Nuxt", hostFlag: "--host" };

  return { name: "Next.js", hostFlag: "--hostname" };
};

// ✅ Ensure Vite config has allowedHosts
const ensureViteConfig = async (sandbox, files, projectRoot, projectDir) => {
  console.log("[Preview] ensureViteConfig called");
  console.log(`[Preview] projectRoot: ${projectRoot}`);
  console.log(`[Preview] projectDir: ${projectDir}`);

  // Always write to projectRoot (frontend folder)
  const viteConfigPath = `${projectRoot}/vite.config.js`;

  const configContent = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    strictPort: false,
  },
});`;

  await sandbox.files.write(viteConfigPath, configContent);
  console.log(`[Preview] Wrote vite.config.js at ${viteConfigPath}`);

  // Verify file content
  try {
    const check = await sandbox.commands.run(`cat ${viteConfigPath}`, {
      cwd: projectRoot,
      timeoutMs: 5000,
    });
    console.log(`[Preview] Config file content:\n${check.stdout}`);
  } catch (err) {
    console.log(`[Preview] Could not verify config: ${err.message}`);
  }
};

router.post("/:projectId", authenticate, async (req, res) => {
  let sandbox;
  let files = [];
  let previewLimit;
  try {
    console.log(
      `[Preview] Request started for project ${req.params.projectId}`,
    );
    if (
      !process.env.E2B_API_KEY ||
      process.env.E2B_API_KEY === "your-e2b-api-key"
    ) {
      console.log("[Preview] E2B credentials are not configured");
      return res.status(503).json({
        error:
          "Preview is not configured. Add E2B_API_KEY to the backend environment.",
      });
    }
    console.log("[Preview] Checking preview usage limit");
    previewLimit = await checkPreviewLimit(req.userId);
    console.log(
      `[Preview] Preview limit checked: allowed=${previewLimit.allowed}`,
    );
    if (!previewLimit.allowed)
      return res.status(429).json({ error: previewLimit.message });
    const project = await db.project.findFirst({
      where: { id: req.params.projectId, userId: req.userId },
      select: { files: true },
    });
    console.log(`[Preview] Project loaded: ${Boolean(project)}`);
    if (!project) return res.status(404).json({ error: "Project not found" });
    files = Array.isArray(project.files) ? project.files : [];
    console.log(`[Preview] Validating ${files.length} project files`);
    if (
      !files.length ||
      files.length > 200 ||
      files.some((file) => !validFile(file))
    ) {
      return res
        .status(400)
        .json({ error: "Project files failed preview validation" });
    }
    const packageFile = files.find(
      (file) =>
        file.path === "package.json" || file.path === "frontend/package.json",
    );
    const postcssFile = files.find(
      (file) =>
        file.path === "postcss.config.js" ||
        file.path === "postcss.config.mjs" ||
        file.path === "frontend/postcss.config.js" ||
        file.path === "frontend/postcss.config.mjs",
    );
    const tailwindConfigFile = files.find(
      (file) =>
        file.path === "tailwind.config.js" ||
        file.path === "tailwind.config.ts" ||
        file.path === "frontend/tailwind.config.js" ||
        file.path === "frontend/tailwind.config.ts",
    );
    if (!packageFile) {
      return res
        .status(400)
        .json({ error: "Generated project is missing package.json" });
    }
    console.log("[Preview] package.json found");
    let packageJson;
    try {
      packageJson = JSON.parse(packageFile.content);
    } catch {
      return res
        .status(400)
        .json({ error: "Generated project has an invalid package.json" });
    }
    if (!packageJson.scripts || typeof packageJson.scripts.dev !== "string") {
      return res
        .status(400)
        .json({ error: "Generated project has no dev script" });
    }
    console.log(`[Preview] Project dev script: ${packageJson.scripts.dev}`);

    const tailwindMajor = getTailwindMajorVersion(packageJson);
    const usesTailwindV3 = tailwindMajor === null || tailwindMajor < 4;
    const hasNextConfig = files.some((file) =>
      /^next\.config\.(js|mjs|ts)$/.test(file.path),
    );
    const missingTailwindPlugins = getMissingTailwindPlugins(
      tailwindConfigFile,
      packageJson,
    );

    // ✅ Detect framework (Vite vs Next.js vs CRA)
    const framework = detectFramework(packageJson);
    console.log(`[Preview] Framework detected: ${framework.name}`);

    // Determine the project root: if frontend/package.json exists, use frontend/
    const projectRoot = files.some(
      (file) => file.path === "frontend/package.json",
    )
      ? `${E2B_PROJECT_DIR}/frontend`
      : E2B_PROJECT_DIR;

    console.log(
      `[Preview] Tailwind major version detected: ${tailwindMajor ?? "none declared"} (treating as v3 rewrite: ${usesTailwindV3})`,
    );
    console.log(`[Preview] Project root: ${projectRoot}`);
    if (missingTailwindPlugins.length) {
      console.log(
        `[Preview] Missing Tailwind plugins detected: ${missingTailwindPlugins.join(", ")}`,
      );
    }
    console.log("[Preview] Trying E2B");

    sandbox = await Sandbox.create(process.env.E2B_TEMPLATE_ID || "base", {
      apiKey: process.env.E2B_API_KEY,
      timeoutMs: 30 * 60 * 1000,
      network: { allowPublicTraffic: true },
    });
    console.log(`[Preview] E2B sandbox created: ${sandbox.sandboxId}`);

    // Create base directory first
    await runE2BCommand(sandbox, "mkdir -p /home/user");

    // Create project root directory BEFORE setting cwd
    await runE2BCommand(sandbox, `mkdir -p ${projectRoot}`);

    const commandOptions = { cwd: projectRoot };

    for (const file of files) {
      const isCssFile = file.path.endsWith(".css");
      const content =
        usesTailwindV3 && isCssFile
          ? file.content
              .replace(
                /@import\s+["']tailwindcss["']\s*;/g,
                "@tailwind base;\n@tailwind components;\n@tailwind utilities;",
              )
              .replace(
                /@tailwindcss\s+(base|components|utilities)\s*;/g,
                "@tailwind $1;",
              )
          : file.content;
      const destination = path.posix.join(E2B_PROJECT_DIR, file.path);
      await runE2BCommand(
        sandbox,
        `mkdir -p ${JSON.stringify(path.posix.dirname(destination))}`,
        commandOptions,
      );
      await sandbox.files.write(destination, content);
    }

    // ✅ Framework-specific config handling
    if (framework.name === "Next.js" && !hasNextConfig) {
      await sandbox.files.write(
        `${projectRoot}/next.config.js`,
        `/** Preview compatibility config for remote portfolio images. */
module.exports = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' }
    ]
  }
};`,
      );
      console.log("[Preview] Added next.config.js");
    } else if (framework.name === "Vite") {
      await ensureViteConfig(sandbox, files, projectRoot, E2B_PROJECT_DIR);
    }

    console.log("[Preview] Project files uploaded");

    if (postcssFile?.content.includes("autoprefixer")) {
      console.log("[Preview] Installing autoprefixer");
      await runE2BCommand(
        sandbox,
        "npm install --no-save --no-audit --no-fund --legacy-peer-deps autoprefixer >> /tmp/genetix-install.log 2>&1",
        commandOptions,
      );
    }
    console.log("[Preview] Installing project dependencies");
    await runE2BCommand(
      sandbox,
      "npm install --no-audit --no-fund --legacy-peer-deps > /tmp/genetix-install.log 2>&1",
      commandOptions,
    );

    if (missingTailwindPlugins.length) {
      console.log(
        `[Preview] Installing missing Tailwind plugins: ${missingTailwindPlugins.join(", ")}`,
      );
      await runE2BCommand(
        sandbox,
        `npm install --no-save --no-audit --no-fund --legacy-peer-deps ${missingTailwindPlugins.join(" ")} >> /tmp/genetix-install.log 2>&1`,
        commandOptions,
      );
    }

    console.log("[Preview] Starting dev server");

    // ✅ Use explicit --config for Vite to ensure config is loaded
    let devCommand;
    if (framework.name === "Vite") {
      devCommand = `npm run dev -- --host 0.0.0.0 --port ${E2B_PREVIEW_PORT} --config ${projectRoot}/vite.config.js`;
    } else {
      devCommand = `npm run dev -- ${framework.hostFlag} 0.0.0.0 --port ${E2B_PREVIEW_PORT}`;
    }

    console.log(`[Preview] Dev command: ${devCommand}`);

    await sandbox.commands.run(`${devCommand} > /tmp/genetix.log 2>&1`, {
      ...commandOptions,
      background: true,
      timeoutMs: E2B_DEV_SERVER_TIMEOUT_MS,
      requestTimeoutMs: 60 * 1000,
    });

    console.log("[Preview] Waiting for dev server");
    await runE2BCommand(
      sandbox,
      'for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 43 44 45; do ss -ltn "sport = :3000" | grep -q LISTEN && exit 0; sleep 1; done; printf "\\n--- Listening ports ---\\n"; ss -ltn 2>&1 || true; printf "\\n--- Dev server runtime log ---\\n"; cat /tmp/genetix.log 2>/dev/null || true; exit 1',
      commandOptions,
    );
    await incrementPreviewUsage(req.userId);
    const host = sandbox.getHost(E2B_PREVIEW_PORT);
    const previewUrl = /^https?:\/\//i.test(host) ? host : `https://${host}`;
    console.log("[Preview] E2B succeeded");
    await savePreviewThumbnail(
      req.params.projectId,
      `${previewUrl}?preview=${Date.now()}`,
    );
    res.json({
      previewUrl: `${previewUrl}?preview=${Date.now()}`,
      expiresInMinutes: 15,
      remaining: previewLimit.remaining - 1,
    });
  } catch (error) {
    console.log(
      `[Preview] E2B failed: ${error instanceof Error ? error.message : "Unknown E2B error"}`,
    );
    let runtimeLog = "";
    let installLog = "";
    if (sandbox) {
      try {
        runtimeLog = await sandbox.files.read("/tmp/genetix.log");
      } catch {
        runtimeLog = "";
      }
      try {
        installLog = await sandbox.files.read("/tmp/genetix-install.log");
      } catch {
        installLog = "";
      }
    }
    if (sandbox) await sandbox.kill().catch(() => undefined);
    const rawDetails = `${error.message || ""}\n--- npm install log ---\n${installLog}\n--- Dev server runtime log ---\n${runtimeLog}`;
    console.log(
      `[Preview] Raw failure details:\n${rawDetails.trim() || "(no details captured)"}`,
    );
    let friendly =
      "The generated project could not start. Please try generating it again.";
    if (/globals\.css|SyntaxError|postcss|tailwind/i.test(rawDetails)) {
      friendly =
        "Preview could not compile the generated styles. Try generating again, or remove advanced CSS directives from the project.";
    } else if (/npm install|lockfile|dependencies/i.test(rawDetails)) {
      friendly =
        "Preview dependencies could not be installed in the sandbox. Please try again in a moment.";
    } else if (/timeout|deadline/i.test(rawDetails)) {
      friendly = "Preview took too long to start. Please try again.";
    } else if (/missing package\.json|no dev script/i.test(rawDetails)) {
      friendly =
        "Generated project is missing required files. Please regenerate.";
    } else if (/Unknown option|CACError/i.test(rawDetails)) {
      friendly =
        "Preview framework configuration issue. Please try generating again.";
    } else if (/Blocked request|allowedHosts/i.test(rawDetails)) {
      friendly =
        "Preview host configuration issue. Please try generating again.";
    } else if (/fetch failed|ECONNRESET|ETIMEDOUT/i.test(rawDetails)) {
      friendly =
        "Preview sandbox had a temporary connection issue. Please try again.";
    }
    console.log(`[Preview] Sending failure response: ${friendly}`);
    res.status(502).json({ error: friendly });
  }
});

module.exports = router;
