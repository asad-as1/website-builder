export type StackBlitzFile = { path: string; content: string };

export interface StackBlitzProjectInput {
  name?: string;
  prompt?: string;
  files: StackBlitzFile[];
}

/**
 * Prepares files and configuration for StackBlitz WebContainer.
 * In a monorepo structure (frontend/ and backend/), StackBlitz needs
 * a root .stackblitzrc and package.json to know what command to run.
 * Without this, WebContainer boots into an empty root shell and hangs on "Booting WebContainer".
 */
export function prepareStackBlitzPayload(
  project: StackBlitzProjectInput,
  preferredOpenFile?: string
) {
  const fileMap: Record<string, string> = {};

  const hasFrontendDir = project.files.some((f) => f.path.startsWith("frontend/"));
  const hasFrontendPkg = project.files.some((f) => f.path === "frontend/package.json");

  for (const f of project.files) {
    if (hasFrontendDir && hasFrontendPkg && f.path.startsWith("frontend/")) {
      // Elevate frontend files to root for direct, instant Vite boot in StackBlitz
      const rootPath = f.path.replace(/^frontend\//, "");
      fileMap[rootPath] = f.content;
    } else {
      fileMap[f.path] = f.content;
    }
  }

  // Ensure dev script in package.json has --host for StackBlitz WebContainer auto-preview
  if (fileMap["package.json"]) {
    try {
      const pkg = JSON.parse(fileMap["package.json"]);
      if (pkg.scripts && pkg.scripts.dev && !pkg.scripts.dev.includes("--host")) {
        pkg.scripts.dev = `${pkg.scripts.dev} --host`;
      }
      pkg.stackblitz = { startCommand: "npm run dev" };
      fileMap["package.json"] = JSON.stringify(pkg, null, 2);
    } catch {
      // ignore
    }
  } else {
    fileMap["package.json"] = JSON.stringify(
      {
        name: (project.name || "genetix-app")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "genetix-app",
        private: true,
        version: "1.0.0",
        scripts: {
          dev: "npx --yes serve .",
          start: "npx --yes serve .",
        },
      },
      null,
      2
    );
  }

  // Also include .stackblitzrc
  fileMap[".stackblitzrc"] = JSON.stringify(
    {
      startCommand: "npm run dev",
    },
    null,
    2
  );

  let openFile = preferredOpenFile;
  if (openFile && openFile.startsWith("frontend/")) {
    openFile = openFile.replace(/^frontend\//, "");
  }
  if (!openFile || !fileMap[openFile]) {
    openFile =
      (fileMap["src/App.jsx"] && "src/App.jsx") ||
      (fileMap["src/App.tsx"] && "src/App.tsx") ||
      (fileMap["index.html"] && "index.html") ||
      Object.keys(fileMap)[0] ||
      "package.json";
  }

  return {
    projectPayload: {
      title: project.name || "Genetix Project",
      description: project.prompt || "Generated with Genetix AI",
      template: "node" as const,
      files: fileMap,
    },
    openFile,
  };
}
