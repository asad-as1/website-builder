"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import StackBlitzSDK from "@stackblitz/sdk";
import ConfirmationModal from "@/components/shared/ConfirmationModal";
import { Copy, Check, ExternalLink, Palette, Bot, Sparkles, Play } from "lucide-react";
import GitHubExportModal from "@/components/editor/GitHubExportModal";
import ThemeCustomizerModal from "@/components/editor/ThemeCustomizerModal";
import AiCopilotDrawer from "@/components/editor/AiCopilotDrawer";
import { prepareStackBlitzPayload } from "@/lib/stackblitz";

const GithubIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

type ProjectFile = { path: string; content: string };
type ProjectVersion = { id: string; message?: string | null; createdAt: string; files: ProjectFile[] };
type Project = { id: string; name: string; prompt: string; files: ProjectFile[]; versions: ProjectVersion[] };
type PreviewMode = "mobile" | "tablet" | "desktop";

export default function EditorPage() {
  const { data: session, status } = useSession();
  const params = useParams<{ projectId?: string; projectSlug?: string }>();
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const [project, setProject] = useState<Project | null>(null);
  const [activePath, setActivePath] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [instruction, setInstruction] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewRemaining, setPreviewRemaining] = useState<number | null>(null);
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(240);
  const [editorHeight, setEditorHeight] = useState(62);
  const [resizing, setResizing] = useState<"left" | "right" | "height" | null>(null);
  const [deletingVersion, setDeletingVersion] = useState("");
  const [selectedVersion, setSelectedVersion] = useState<ProjectVersion | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [isDirty, setIsDirty] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [aiCommands, setAiCommands] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [activePreviewType, setActivePreviewType] = useState<"stackblitz" | "e2b" | null>(null);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [isE2BLoading, setIsE2BLoading] = useState(false);
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  useEffect(() => {
    if (!resizing) return;
    const handlePointerMove = (event: PointerEvent) => {
      if (resizing === "left") setLeftWidth(Math.max(220, Math.min(480, event.clientX - 16)));
      if (resizing === "right") setRightWidth(Math.max(200, Math.min(420, window.innerWidth - event.clientX - 16)));
      if (resizing === "height") setEditorHeight(Math.max(35, Math.min(82, (event.clientY / window.innerHeight) * 100)));
    };
    const stopResizing = () => setResizing(null);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
    };
  }, [resizing]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [router, status]);

  useEffect(() => {
    const projectSlug = params.projectSlug || params.projectId;
    if (!apiUrl || !session?.user.accessToken || !projectSlug) return;
    fetch(`${apiUrl}/ai/projects/by-slug/${projectSlug}`, {
      headers: { Authorization: `Bearer ${session.user.accessToken}` },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Project could not be loaded");
        return data.project as Project;
      })
      .then((loaded) => {
        setProject(loaded);
        const firstPath = loaded.files?.[0]?.path || "";
        setActivePath(firstPath);
        setContent(loaded.files?.[0]?.content || "");
        setAiCommands(JSON.parse(window.localStorage.getItem(`genetix-ai-history-${loaded.id}`) || "[]"));
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Project could not be loaded"));
  }, [apiUrl, params.projectId, params.projectSlug, session?.user.accessToken]);

  useEffect(() => {
    if (!apiUrl || !session?.user.accessToken) return;
    fetch(`${apiUrl}/auth/me`, { headers: { Authorization: `Bearer ${session.user.accessToken}` } })
      .then((response) => response.json())
      .then((data) => {
        if (data.user) {
          const limit = data.user.role === "admin" ? 30 : 10;
          setPreviewRemaining(Math.max(limit - (data.user.previewUsage || 0), 0));
        }
      })
      .catch((loadError) => console.log("[Preview UI] Could not load preview usage:", loadError));
  }, [apiUrl, session?.user.accessToken]);

  const selectFile = (file: ProjectFile) => {
    setActivePath(file.path);
    setContent(file.content);
    setIsDirty(false);
  };

  // ✅ saveFile with createVersion flag
  const saveFile = async (createVersion: boolean = true) => {
    if (!project || !apiUrl || !session?.user.accessToken) return;
    const files = project.files.map((file) =>
      file.path === activePath ? { ...file, content } : file
    );
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${apiUrl}/ai/projects/${project.id}/files`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.user.accessToken}`,
        },
        body: JSON.stringify({ 
          files, 
          message: createVersion ? `Edited ${activePath}` : "Autosaved",
          createVersion  // ✅ Backend ko batao version banana hai ya nahi
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save file");
      setProject((current) => current ? { ...current, ...data.project, files } : current);
      setMessage(createVersion ? "File saved and version created." : "Autosaved.");
      setIsDirty(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save file");
    } finally {
      setIsSaving(false);
    }
  };

  // ✅ Autosave — no version creation, 3 second debounce
  useEffect(() => {
    if (!isDirty || !project || !activePath) return;
    const timer = window.setTimeout(() => { void saveFile(false); }, 3000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, content, isDirty, project?.id]);

  const rollback = async (versionId: string) => {
    if (!project || !apiUrl || !session?.user.accessToken) return;
    const response = await fetch(`${apiUrl}/ai/projects/${project.id}/rollback/${versionId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.user.accessToken}` },
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Rollback failed");
      return;
    }
    const nextFiles = data.project.files || project.files;
    setProject((current) => current ? { ...current, ...data.project, files: nextFiles } : current);
    setContent(nextFiles.find((file: ProjectFile) => file.path === activePath)?.content || "");
    setMessage("Version restored.");
  };

  const downloadZip = async () => {
    if (!project || !apiUrl || !session?.user.accessToken) return;
    const response = await fetch(`${apiUrl}/ai/projects/${project.id}/download`, {
      headers: { Authorization: `Bearer ${session.user.accessToken}` },
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || "ZIP download failed");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name || "project"}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const applyAiEdit = async (customPrompt?: string) => {
    const textToApply = (customPrompt || instruction).trim();
    if (!project || !apiUrl || !session?.user.accessToken || textToApply.length < 5) return;
    setIsEditing(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${apiUrl}/ai/projects/${project.id}/edit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.user.accessToken}`,
        },
        body: JSON.stringify({ instruction: textToApply, selectedPaths: [activePath] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI edit failed");
      const nextProject = data.project as Project;
      setProject((current) => current ? { ...current, ...nextProject } : current);
      setContent(nextProject.files.find((file) => file.path === activePath)?.content || "");
      if (!customPrompt) setInstruction("");
      const nextCommands = [textToApply, ...aiCommands].slice(0, 12);
      setAiCommands(nextCommands);
      window.localStorage.setItem(`genetix-ai-history-${project.id}`, JSON.stringify(nextCommands));
      setMessage("AI edit applied and version created.");
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "AI edit failed");
      throw editError;
    } finally {
      setIsEditing(false);
    }
  };

  const handleCopilotChat = async (chatMessage: string): Promise<string> => {
    if (!project || !apiUrl || !session?.user?.accessToken) {
      throw new Error("User session or project missing");
    }
    const response = await fetch(`${apiUrl}/ai/projects/${project.id}/copilot/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.user.accessToken}`,
      },
      body: JSON.stringify({ message: chatMessage, activePath }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Copilot response failed");
    return data.reply;
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setMessage("Share link copied to clipboard!");
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      setMessage("Could not auto-copy. Please copy link manually.");
    }
  };

  const shareProject = async () => {
    if (!project || !apiUrl || !session?.user.accessToken) return;
    if (isDirty) {
      await saveFile(false);
    }
    const response = await fetch(`${apiUrl}/ai/projects/${project.id}/share`, { method: "POST", headers: { Authorization: `Bearer ${session.user.accessToken}` } });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Sharing failed"); return; }
    const url = `${window.location.origin}/share/${data.shareToken}`;
    setShareUrl(url);
    try {
      await navigator.clipboard?.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
      setMessage("Share link generated and copied to clipboard!");
    } catch {
      setMessage("Share link generated!");
    }
  };

  const undoLastAiEdit = () => {
    const previous = project?.versions?.[1];
    if (previous) void rollback(previous.id);
  };

  // Start preview with StackBlitz as primary (Free & Unlimited - 0 credits used)
  const startPreview = async () => {
    if (isPreviewing || !project) return;
    if (isDirty) {
      await saveFile(false);
    }
    setError("");
    setMessage("Starting StackBlitz Live Sandbox (Free & Unlimited)...");
    setActivePreviewType("stackblitz");
    setPreviewUrl("");
    setPreviewRefreshKey((k) => k + 1);
  };

  // Fallback or explicit cloud sandbox (uses 1 credit via backend E2B)
  const startE2BPreview = async () => {
    if (isE2BLoading || !project || !apiUrl || !session?.user.accessToken) return;
    if (isDirty) {
      await saveFile(false);
    }
    console.log("[Preview UI] Starting Cloud E2B Sandbox");
    setIsE2BLoading(true);
    setError("");
    setMessage("Starting Cloud Sandbox (E2B)...");
    try {
      const response = await fetch(`${apiUrl}/preview/${project.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.user.accessToken}` },
      });
      const data = await response.json();
      if (typeof data.remaining === "number") setPreviewRemaining(data.remaining);
      if (!response.ok) {
        if (response.status === 429 || response.status < 500) {
          throw new Error(data.error || "Cloud preview is currently unavailable.");
        }
        throw new Error(data.error || "Cloud preview failed");
      }
      console.log(`[Preview UI] Backend preview succeeded via ${data.provider || "E2B"}`);
      setPreviewUrl(data.previewUrl);
      setActivePreviewType("e2b");
      setMessage(`Cloud preview ready (${data.remaining} credits remaining).`);
    } catch (previewError) {
      console.log(`[Preview UI] E2B request failed: ${previewError instanceof Error ? previewError.message : "Unknown error"}`);
      setError(previewError instanceof Error ? previewError.message : "Cloud preview failed");
    } finally {
      setIsE2BLoading(false);
    }
  };

  const closePreview = () => {
    setActivePreviewType(null);
    setPreviewUrl("");
    setIsPreviewing(false);
    setIsE2BLoading(false);
  };

  // Auto-embed StackBlitz when activePreviewType === "stackblitz" (exact same reliable method as share page)
  useEffect(() => {
    if (activePreviewType !== "stackblitz" || !project) return;
    let isMounted = true;
    setIsPreviewing(true);

    const timer = setTimeout(() => {
      const container = document.getElementById("editor-stackblitz-embed");
      if (!container || !isMounted) return;

      try {
        const latestFiles = project.files.map((file) =>
          file.path === activePath ? { ...file, content } : file
        );
        const { projectPayload, openFile } = prepareStackBlitzPayload({
          ...project,
          files: latestFiles,
        });

        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }

        StackBlitzSDK.embedProject(container, projectPayload, {
          openFile,
          view: "preview",
          height: 620,
          terminalHeight: 25,
          hideNavigation: false,
          crossOriginIsolated: true,
        })
          .then(() => {
            if (isMounted) {
              setIsPreviewing(false);
              setMessage("⚡ Live StackBlitz sandbox running (Unlimited free preview).");
            }
          })
          .catch((err) => {
            console.warn("[Editor Preview] StackBlitz SDK error:", err);
            if (isMounted) {
              setIsPreviewing(false);
            }
          });
      } catch (embedErr) {
        console.error("[Editor Preview] Setup error:", embedErr);
        if (isMounted) {
          setIsPreviewing(false);
        }
      }
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activePreviewType, project?.id, previewRefreshKey]);

  const openStackBlitz = () => {
    if (!project) return;
    // Always merge in-memory editor changes so preview is 100% up-to-date with latest edits
    const latestFiles = project.files.map((file) =>
      file.path === activePath ? { ...file, content } : file
    );
    const { projectPayload, openFile } = prepareStackBlitzPayload({
      ...project,
      files: latestFiles,
    });
    StackBlitzSDK.openProject(projectPayload, { openFile });
  };

  const deleteVersion = async (versionId: string) => {
    if (!project || !apiUrl || !session?.user.accessToken) return;
    setDeletingVersion(versionId);
    try {
      const response = await fetch(`${apiUrl}/ai/projects/${project.id}/versions/${versionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.user.accessToken}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Version deletion failed");
      setProject((current) => current ? { ...current, versions: current.versions.filter((version) => version.id !== versionId) } : current);
      setSelectedVersion(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Version deletion failed");
    } finally {
      setDeletingVersion("");
    }
  };

  if (status === "loading" || !project) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0f] text-white">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />
          <p className="text-sm text-gray-300">{error || "Loading project..."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] p-4 pt-20 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button onClick={() => router.push("/dashboard")} className="text-sm text-cyan-300">← Dashboard</button>
            <h1 className="mt-2 text-2xl font-bold">{project.name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsThemeModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-xs sm:text-sm font-semibold text-gray-200 transition cursor-pointer"
              title="Customize theme, colors and typography"
            >
              <Palette className="w-4 h-4 text-cyan-400" />
              <span>Theme</span>
            </button>

            <button
              onClick={() => setIsGitHubModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-xs sm:text-sm font-semibold text-gray-200 transition cursor-pointer"
              title="Push this project to your GitHub profile"
            >
              <GithubIcon className="w-4 h-4 text-white" />
              <span>GitHub</span>
            </button>

            <button
              onClick={() => setIsCopilotOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-500/30 to-cyan-500/30 hover:from-purple-500/40 hover:to-cyan-500/40 border border-purple-400/40 px-3 py-2 text-xs sm:text-sm font-semibold text-purple-200 shadow-sm transition cursor-pointer"
              title="Open AI Copilot Pair Programmer"
            >
              <Bot className="w-4 h-4 text-cyan-300" />
              <span>AI Copilot</span>
            </button>

            <button onClick={downloadZip} className="rounded-lg bg-white/10 hover:bg-white/15 px-3 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer">
              Download ZIP
            </button>
            <button onClick={shareProject} className="rounded-lg bg-purple-500/20 hover:bg-purple-500/30 px-3 py-2 text-xs sm:text-sm font-semibold text-purple-200 transition cursor-pointer">
              Share
            </button>
            <button
              onClick={activePreviewType ? closePreview : startPreview}
              disabled={isPreviewing || isE2BLoading}
              className="rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 px-3 py-2 text-xs sm:text-sm font-semibold text-emerald-300 disabled:opacity-60 transition cursor-pointer flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-emerald-300" />
              <span>{activePreviewType ? "Close Preview" : "Live Preview (Free)"}</span>
              {previewRemaining !== null && (
                <span className="opacity-75 text-[11px] font-normal">({previewRemaining} E2B)</span>
              )}
            </button>
            <button onClick={() => saveFile(true)} disabled={isSaving} className="rounded-lg bg-cyan-500 hover:bg-cyan-400 px-3 py-2 text-xs sm:text-sm font-semibold text-black disabled:opacity-60 transition cursor-pointer">
              {isSaving ? "Saving..." : "Save version"}
            </button>
          </div>
        </div>
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        {message && <p className="mb-3 text-sm text-emerald-400">{message}</p>}

        {/* StackBlitz Live Sandbox Section (Default - Free & Unlimited) */}
        {activePreviewType === "stackblitz" && (
          <section className="mb-6 rounded-2xl border border-white/10 bg-[#12121c] p-4 sm:p-5 shadow-2xl">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2 text-xs text-gray-300 font-medium">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>StackBlitz Live Sandbox • <span className="text-emerald-300 font-semibold">Unlimited Free (0 credits used)</span></span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPreviewRefreshKey((k) => k + 1)}
                  className="text-xs text-emerald-300 hover:text-emerald-200 underline flex items-center gap-1 cursor-pointer font-medium"
                  title="Reload preview with your latest editor code"
                >
                  ↻ Refresh
                </button>
                <button
                  onClick={openStackBlitz}
                  className="text-xs text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  <span>Open full screen</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
                <button
                  onClick={startE2BPreview}
                  disabled={isE2BLoading}
                  className="text-xs text-purple-300 hover:text-purple-200 underline cursor-pointer font-medium"
                  title="Switch to backend Cloud E2B Sandbox (-1 preview limit)"
                >
                  {isE2BLoading ? "Starting Cloud..." : "☁️ Run on Cloud Sandbox (E2B)"}
                </button>
                <button
                  onClick={closePreview}
                  className="text-xs text-gray-400 hover:text-white px-2 py-0.5 rounded bg-white/5 cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            <div className="relative min-h-[620px] rounded-xl overflow-hidden border border-white/10 bg-black">
              {isPreviewing && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0a0a0f]/85 backdrop-blur-sm p-6 text-center gap-3">
                  <span className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-400/20 border-t-cyan-400" />
                  <div>
                    <p className="text-sm text-cyan-200 font-semibold">
                      Booting StackBlitz in browser...
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Running Vite dev server directly in WebContainer
                    </p>
                  </div>
                </div>
              )}
              <div id="editor-stackblitz-embed" className="w-full min-h-[620px]" />
            </div>
          </section>
        )}

        {/* Cloud E2B Sandbox Section (Fallback or manual switch - uses 1 credit) */}
        {activePreviewType === "e2b" && (
          <section className="mb-6 rounded-2xl border border-white/10 bg-[#12121c] p-4 sm:p-5 shadow-2xl">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-purple-300 font-medium">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-400" />
                  <span>Cloud Sandbox (E2B)</span>
                </div>
                <div className="flex gap-1 rounded-lg bg-white/5 p-1">
                  {(["mobile", "tablet", "desktop"] as PreviewMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setPreviewMode(mode)}
                      className={`rounded-md px-2.5 py-0.5 text-xs capitalize transition ${
                        previewMode === mode ? "bg-cyan-500/30 text-cyan-200 font-semibold" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setPreviewUrl(""); setActivePreviewType("stackblitz"); }}
                  className="text-xs text-emerald-300 hover:text-emerald-200 underline cursor-pointer font-medium"
                >
                  ⚡ Switch back to StackBlitz (Free)
                </button>
                <button
                  onClick={closePreview}
                  className="text-xs text-gray-400 hover:text-white px-2 py-0.5 rounded bg-white/5 cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            <div className="flex justify-center overflow-auto rounded-xl border border-white/10 bg-black/40 p-2">
              {previewUrl ? (
                <iframe
                  title="Cloud live preview"
                  src={previewUrl}
                  className="h-[70vh] rounded-lg border border-white/10 bg-white transition-all"
                  style={{ width: previewMode === "mobile" ? 390 : previewMode === "tablet" ? 768 : "100%" }}
                />
              ) : (
                <div className="flex min-h-48 items-center justify-center text-sm text-purple-200">
                  <span className="h-8 w-8 animate-spin rounded-full border-4 border-purple-400/20 border-t-purple-400 mr-3" />
                  Starting Cloud Sandbox...
                </div>
              )}
            </div>
          </section>
        )}
        {shareUrl && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-purple-400/30 bg-purple-500/10 p-3.5 text-sm text-purple-200">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-semibold shrink-0 text-purple-300">Public share link:</span>
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate underline text-purple-200 hover:text-white transition flex items-center gap-1.5"
                title={shareUrl}
              >
                <span className="truncate">{shareUrl}</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70" />
              </a>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/40 text-purple-100 font-medium transition cursor-pointer text-xs"
                title="Copy link to clipboard"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy link</span>
                  </>
                )}
              </button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition text-xs font-medium cursor-pointer"
              >
                Open
              </a>
            </div>
          </div>
        )}
        <div className="grid min-h-[70vh] gap-0 lg:grid-cols-[var(--left-width)_12px_minmax(0,1fr)_12px_var(--right-width)]" style={{ "--left-width": `${leftWidth}px`, "--right-width": `${rightWidth}px` } as CSSProperties}>
          <aside className="glass min-w-0 rounded-xl p-3">
            <h2 className="mb-3 text-sm font-semibold text-gray-400">Files</h2>
            <div className="space-y-1">
              {project.files.map((file) => (
                <button key={file.path} onClick={() => selectFile(file)} className={`block w-full rounded px-2 py-2 text-left text-sm ${file.path === activePath ? "bg-cyan-500/20 text-cyan-200" : "text-gray-300 hover:bg-white/5"}`}>
                  <span className="block truncate" title={file.path}>{file.path}</span>
                </button>
              ))}
            </div>
          </aside>
          <button type="button" aria-label="Resize files sidebar" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setResizing("left"); }} className="hidden cursor-col-resize items-center justify-center border-x border-white/10 bg-white/[0.03] text-lg text-gray-500 transition hover:bg-cyan-400/10 hover:text-cyan-300 lg:flex" title="Drag to resize">
            ↔
          </button>
          <section className="glass rounded-xl p-3">
            <div className="mb-2 text-sm text-gray-400">{activePath || "Select a file"}</div>
            <textarea value={content} onChange={(event) => { setContent(event.target.value); setIsDirty(true); }} style={{ height: `${editorHeight}vh` }} className="w-full resize-none rounded-lg bg-black/40 p-4 font-mono text-sm text-gray-200 outline-none focus:ring-1 focus:ring-cyan-400" spellCheck={false} />
            <button type="button" aria-label="Resize editor height" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setResizing("height"); }} className="my-1 flex h-5 w-full cursor-row-resize items-center justify-center rounded border border-white/10 bg-white/[0.03] text-sm leading-none text-gray-500 transition hover:bg-cyan-400/10 hover:text-cyan-300" title="Drag to resize editor">
              ↕
            </button>
            <div className="mt-3 flex gap-2">
              <input value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Ask AI to change this file..." className="min-w-0 flex-1 rounded-lg bg-black/30 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-cyan-400" />
              <button onClick={() => void applyAiEdit()} disabled={isEditing || instruction.trim().length < 5} className="rounded-lg bg-purple-500 px-3 py-2 text-sm font-semibold disabled:opacity-60">
                {isEditing ? "Editing..." : "AI Edit"}
              </button>
            </div>
            {aiCommands.length > 0 && <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">AI command history</p><button onClick={undoLastAiEdit} disabled={!project.versions?.[1]} className="text-xs text-amber-300 disabled:opacity-40">Undo last</button></div><div className="space-y-1">{aiCommands.slice(0, 4).map((command, index) => <button key={`${command}-${index}`} onClick={() => setInstruction(command)} className="block w-full truncate text-left text-xs text-gray-400 hover:text-cyan-200">↳ {command}</button>)}</div></div>}
          </section>
          <button type="button" aria-label="Resize version sidebar" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setResizing("right"); }} className="hidden cursor-col-resize items-center justify-center border-x border-white/10 bg-white/[0.03] text-lg text-gray-500 transition hover:bg-cyan-400/10 hover:text-cyan-300 lg:flex" title="Drag to resize">
            ↔
          </button>
          <aside className="glass rounded-xl p-3">
            <h2 className="mb-3 text-sm font-semibold text-gray-400">Version history</h2>
            <div className="relative space-y-3 pl-3 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-gradient-to-b before:from-cyan-400/60 before:to-purple-500/20">
              {project.versions?.map((version) => (
                <div key={version.id} className="relative rounded-lg bg-white/5 p-3 before:absolute before:left-[-11px] before:top-5 before:h-2 before:w-2 before:rounded-full before:bg-cyan-300 before:ring-4 before:ring-[#11111a]">
                  <p className="text-sm text-gray-200">{version.message || "Version"}</p>
                  <p className="mt-1 text-xs text-gray-500">{new Date(version.createdAt).toLocaleString()}</p>
                  <div className="mt-2 flex gap-3"><button onClick={() => rollback(version.id)} className="text-xs text-amber-300 hover:underline">Restore</button><button onClick={() => setSelectedVersion(version)} disabled={deletingVersion === version.id} className="text-xs text-red-300 hover:underline">{deletingVersion === version.id ? "Deleting..." : "Delete"}</button></div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
      <ConfirmationModal isOpen={Boolean(selectedVersion)} title="Delete this version?" description="This removes the snapshot from your project timeline." confirmLabel="Delete version" isBusy={Boolean(selectedVersion && deletingVersion === selectedVersion.id)} onClose={() => setSelectedVersion(null)} onConfirm={() => selectedVersion && (setDeletingVersion(selectedVersion.id), deleteVersion(selectedVersion.id))} />

      <GitHubExportModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
        projectName={project.name}
        files={project.files}
      />

      <ThemeCustomizerModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        onApplyTheme={applyAiEdit}
        isApplying={isEditing}
      />

      <AiCopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        projectId={project.id}
        onSendMessage={applyAiEdit}
        onChatQuery={handleCopilotChat}
        isBusy={isEditing}
        activeFilePath={activePath}
      />
    </main>
  );
}