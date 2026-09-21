"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import StackBlitzSDK from "@stackblitz/sdk";
import ConfirmationModal from "@/components/shared/ConfirmationModal";
import { Copy, Check, ExternalLink } from "lucide-react";

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
  const [stackBlitzPreview, setStackBlitzPreview] = useState(false);

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

  const applyAiEdit = async () => {
    if (!project || !apiUrl || !session?.user.accessToken || instruction.trim().length < 5) return;
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
        body: JSON.stringify({ instruction, selectedPaths: [activePath] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI edit failed");
      const nextProject = data.project as Project;
      setProject((current) => current ? { ...current, ...nextProject } : current);
      setContent(nextProject.files.find((file) => file.path === activePath)?.content || "");
      setInstruction("");
      const nextCommands = [instruction.trim(), ...aiCommands].slice(0, 12);
      setAiCommands(nextCommands);
      window.localStorage.setItem(`genetix-ai-history-${project.id}`, JSON.stringify(nextCommands));
      setMessage("AI edit applied and version created.");
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "AI edit failed");
    } finally {
      setIsEditing(false);
    }
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

  const startPreview = async () => {
    if (isPreviewing || !project || !apiUrl || !session?.user.accessToken) return;
    console.log("[Preview UI] Starting E2B");
    setIsPreviewing(true);
    setError("");
    setPreviewUrl("");
    try {
      const response = await fetch(`${apiUrl}/preview/${project.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.user.accessToken}` },
      });
      const data = await response.json();
      console.log(`[Preview UI] Backend response: status=${response.status}, provider=${data.provider || "none"}`);
      if (typeof data.remaining === "number") setPreviewRemaining(data.remaining);
      if (!response.ok) {
        if (response.status === 429 || response.status < 500) {
          throw new Error(data.error || "Preview is currently unavailable.");
        }
        throw new Error(data.error || "Preview failed");
      }
      console.log(`[Preview UI] Backend preview succeeded via ${data.provider || "E2B"}`);
      setPreviewUrl(data.previewUrl);
    } catch (previewError) {
      console.log(`[Preview UI] E2B request failed: ${previewError instanceof Error ? previewError.message : "Unknown error"}`);
      if (previewError instanceof Error && /Daily preview limit|not configured|Project not found|failed validation|missing package|no dev script/i.test(previewError.message)) {
        setError(previewError.message);
        return;
      }
      console.log("[Preview UI] Starting StackBlitz fallback");
      setError(previewError instanceof Error ? previewError.message : "Preview failed");
      setStackBlitzPreview(true);
      setMessage("Preview was unavailable. Open the StackBlitz in a new tab.");
    } finally {
      setIsPreviewing(false);
    }
  };

  const openStackBlitz = () => {
    if (!project) return;
    StackBlitzSDK.openProject({
      title: project.name,
      description: "Generated with Genetix",
      template: "node",
      files: Object.fromEntries(project.files.map((file) => [file.path, file.content])),
    }, { openFile: "app/page.tsx" });
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
          <div className="flex gap-2">
            <button onClick={downloadZip} className="rounded-lg bg-white/10 px-4 py-2 font-semibold">Download ZIP</button>
            <button onClick={shareProject} className="rounded-lg bg-purple-500/20 px-4 py-2 font-semibold text-purple-200">Share</button>
            <button onClick={startPreview} disabled={isPreviewing} className="rounded-lg bg-emerald-500/20 px-4 py-2 font-semibold disabled:opacity-60">
              {isPreviewing ? "Starting..." : "Live Preview"}{previewRemaining !== null ? ` (${previewRemaining} left)` : ""}
            </button>
            <button onClick={() => saveFile(true)} disabled={isSaving} className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold disabled:opacity-60">
              {isSaving ? "Saving..." : "Save version"}
            </button>
          </div>
        </div>
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        {message && <p className="mb-3 text-sm text-emerald-400">{message}</p>}
        {isPreviewing && <div className="mb-4 flex min-h-32 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/5"><div className="flex flex-col items-center gap-3 text-sm text-emerald-200"><span className="h-9 w-9 animate-spin rounded-full border-4 border-emerald-300/20 border-t-emerald-300" /><span>Starting live preview...</span></div></div>}
        {stackBlitzPreview && <section className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-cyan-400/20 bg-black/20 p-3"><span className="text-sm text-cyan-200">Open this project in StackBlitz for a browser-based fallback.</span><div className="flex gap-2"><button onClick={openStackBlitz} className="rounded-md bg-cyan-500/20 px-3 py-1 text-sm text-cyan-100">Open StackBlitz</button><button onClick={() => setStackBlitzPreview(false)} className="text-xs text-gray-400 hover:text-white">Close</button></div></section>}
        {previewUrl && !stackBlitzPreview && <section className="mb-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex gap-1 rounded-lg bg-white/5 p-1">{(["mobile", "tablet", "desktop"] as PreviewMode[]).map((mode) => <button key={mode} onClick={() => setPreviewMode(mode)} className={`rounded-md px-3 py-1 text-xs capitalize ${previewMode === mode ? "bg-cyan-500/30 text-cyan-200" : "text-gray-400"}`}>{mode}</button>)}</div><span className="text-xs text-gray-500">Responsive preview</span></div>
          <div className="flex justify-center overflow-auto"><iframe title="Live preview" src={previewUrl} className="h-[70vh] rounded-xl border border-white/10 bg-white transition-all" style={{ width: previewMode === "mobile" ? 390 : previewMode === "tablet" ? 768 : "100%" }} /></div>
        </section>}
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
              <button onClick={applyAiEdit} disabled={isEditing || instruction.trim().length < 5} className="rounded-lg bg-purple-500 px-3 py-2 text-sm font-semibold disabled:opacity-60">
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
    </main>
  );
}