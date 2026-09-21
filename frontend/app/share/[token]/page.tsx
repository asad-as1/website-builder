"use client";

import { useEffect, useState, useRef, use } from "react";
import StackBlitzSDK from "@stackblitz/sdk";
import {
  Play,
  Code2,
  Copy,
  Check,
  ExternalLink,
  FileCode,
  Sparkles,
  Terminal,
  FolderTree,
  Eye,
} from "lucide-react";
import { prepareStackBlitzPayload } from "@/lib/stackblitz";

type ProjectFile = { path: string; content: string };

type SharedProject = {
  id?: string;
  name: string;
  prompt: string;
  files: ProjectFile[];
  framework?: string;
  thumbnail?: { emoji?: string; gradient?: string };
  updatedAt?: string;
};

export default function SharedProjectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const unwrappedParams = use(params);
  const token = unwrappedParams.token;

  const [project, setProject] = useState<SharedProject | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [activeFilePath, setActiveFilePath] = useState<string>("");
  const [isCopied, setIsCopied] = useState(false);
  const [isRunningStackBlitz, setIsRunningStackBlitz] = useState(false);
  const [embedError, setEmbedError] = useState(false);
  const embedContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
    fetch(`${apiUrl}/ai/shared/${token}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Shared project unavailable");
        return data.project;
      })
      .then((proj: SharedProject) => {
        setProject(proj);
        if (proj.files?.length > 0) {
          const defaultFile =
            proj.files.find(
              (f) =>
                f.path.includes("App.") ||
                f.path.includes("main.") ||
                f.path.endsWith(".html") ||
                f.path.includes("server.")
            ) || proj.files[0];
          setActiveFilePath(defaultFile.path);
        }
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : "Shared project unavailable")
      );
  }, [token]);

  const [inPageEmbedRequested, setInPageEmbedRequested] = useState(true);

  // Embed StackBlitz WebContainer inside container automatically by default
  useEffect(() => {
    if (!project || activeTab !== "preview" || !inPageEmbedRequested) return;

    let isMounted = true;
    setIsRunningStackBlitz(true);

    const timer = setTimeout(() => {
      const container = document.getElementById("stackblitz-embed-box");
      if (!container || !isMounted) return;

      try {
        const { projectPayload, openFile } = prepareStackBlitzPayload(project);

        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }

        StackBlitzSDK.embedProject(
          container,
          projectPayload,
          {
            openFile,
            view: "preview",
            height: 620,
            terminalHeight: 25,
            hideNavigation: false,
            crossOriginIsolated: true,
          }
        )
          .then(() => {
            if (isMounted) setIsRunningStackBlitz(false);
          })
          .catch((err) => {
            console.warn("[StackBlitz Embed] SDK error:", err);
            if (isMounted) setIsRunningStackBlitz(false);
          });
      } catch (embedErr) {
        console.error("[StackBlitz Embed] Setup error:", embedErr);
        if (isMounted) setIsRunningStackBlitz(false);
      }
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [project, activeTab, inPageEmbedRequested]);

  const openStackBlitzTab = () => {
    if (!project) return;
    const { projectPayload, openFile } = prepareStackBlitzPayload(project, "frontend/src/App.jsx");
    StackBlitzSDK.openProject(projectPayload, { openFile });
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  const copyActiveFileCode = async () => {
    const file = project?.files.find((f) => f.path === activeFilePath);
    if (!file) return;
    try {
      await navigator.clipboard.writeText(file.content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (error) {
    return (
      <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6 text-center">
        <div className="max-w-md p-8 rounded-2xl bg-white/5 border border-red-500/20 text-white">
          <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4 text-xl">
            ✕
          </div>
          <h1 className="text-xl font-bold mb-2">Project Unavailable</h1>
          <p className="text-sm text-gray-400 mb-6">{error}</p>
          <a
            href="/"
            className="inline-block px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-sm font-semibold text-white"
          >
            Go to Genetix Home
          </a>
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6 text-white">
        <div className="flex flex-col items-center gap-4">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-400/20 border-t-cyan-400" />
          <p className="text-sm text-gray-400">Loading shared project...</p>
        </div>
      </main>
    );
  }

  const activeFile = project.files.find((f) => f.path === activeFilePath) || project.files[0];

  return (
    <main className="min-h-screen bg-[#0a0a0f] px-4 sm:px-6 lg:px-8 pt-24 pb-16 text-white">
      <div className="mx-auto max-w-7xl">
        {/* Top Header Card */}
        <div className="mb-6 rounded-3xl border border-white/10 bg-[#12121c]/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-purple-950/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${
                  project.thumbnail?.gradient || "from-cyan-500/20 to-purple-600/30"
                } border border-white/10 shadow-lg`}
              >
                <span className="text-3xl">{project.thumbnail?.emoji || "✦"}</span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Live Showcase
                  </span>
                  <span className="text-xs text-gray-400">
                    {project.files.length} source files
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {project.name}
                </h1>
                <p className="mt-1 text-sm text-gray-300 max-w-2xl leading-relaxed">
                  {project.prompt}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                onClick={copyShareLink}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-gray-200 hover:text-white transition cursor-pointer"
              >
                {isCopied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Share Link</span>
                  </>
                )}
              </button>

              <button
                onClick={openStackBlitzTab}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Open in StackBlitz</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </button>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="mt-6 pt-6 border-t border-white/10 flex items-center gap-2">
            <button
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer ${
                activeTab === "preview"
                  ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 shadow-sm shadow-cyan-500/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Eye className="w-4 h-4" />
              Live Interactive Sandbox
            </button>
            <button
              onClick={() => setActiveTab("code")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer ${
                activeTab === "code"
                  ? "bg-purple-500/20 text-purple-200 border border-purple-400/40 shadow-sm shadow-purple-500/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Code2 className="w-4 h-4" />
              Source Code ({project.files.length} Files)
            </button>
          </div>
        </div>

        {/* Tab 1: Live Interactive Sandbox */}
        {activeTab === "preview" && (
          <div className="rounded-3xl border border-white/10 bg-[#12121c] p-4 sm:p-6 shadow-2xl overflow-hidden">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>WebContainer Sandbox • Running live in your browser</span>
              </div>
              <button
                onClick={openStackBlitzTab}
                className="text-xs text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1.5 cursor-pointer font-medium"
              >
                <span>⚡ Open full screen in StackBlitz</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Container for StackBlitz embed */}
            <div className="relative min-h-[640px] rounded-2xl overflow-hidden border border-white/10 bg-black">
              {isRunningStackBlitz && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0a0a0f]/85 backdrop-blur-sm p-6 text-center gap-3">
                  <span className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-400/20 border-t-cyan-400" />
                  <div>
                    <p className="text-sm text-cyan-200 font-semibold">
                      Booting WebContainer & starting Vite...
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Compiling in your browser RAM with zero server latency
                    </p>
                  </div>
                </div>
              )}
              <div id="stackblitz-embed-box" className="w-full min-h-[640px]" />
            </div>
          </div>
        )}

        {/* Tab 2: Source Code Explorer */}
        {activeTab === "code" && (
          <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4 rounded-3xl border border-white/10 bg-[#12121c] p-4 sm:p-6 shadow-2xl">
            {/* File Sidebar */}
            <div className="rounded-2xl border border-white/10 bg-black/40 p-3 max-h-[600px] overflow-y-auto space-y-1">
              <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 border-b border-white/10 mb-2">
                <FolderTree className="w-3.5 h-3.5 text-cyan-400" />
                <span>Files Explorer</span>
              </div>
              {project.files.map((file) => {
                const isSelected = file.path === activeFilePath;
                return (
                  <button
                    key={file.path}
                    onClick={() => setActiveFilePath(file.path)}
                    className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-xl text-xs font-mono transition cursor-pointer truncate ${
                      isSelected
                        ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/40"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{file.path}</span>
                  </button>
                );
              })}
            </div>

            {/* Code Content Viewer */}
            <div className="flex flex-col rounded-2xl border border-white/10 bg-black/60 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/10">
                <div className="flex items-center gap-2 min-w-0">
                  <Terminal className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="font-mono text-xs text-gray-200 truncate">
                    {activeFile?.path}
                  </span>
                </div>
                <button
                  onClick={copyActiveFileCode}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-300 hover:text-white transition cursor-pointer"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-300 font-semibold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-4 overflow-auto max-h-[550px] font-mono text-xs leading-relaxed text-gray-200 whitespace-pre">
                <code>{activeFile?.content}</code>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
