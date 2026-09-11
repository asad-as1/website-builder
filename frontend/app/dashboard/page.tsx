"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type GeneratedFile = { path: string; content: string };
type Project = { id: string; name: string; prompt: string; status: string };
type Analytics = { totals: { projects: number; files: number; versions: number; aiRequests: number; previews: number }; days: { label: string; projects: number; edits: number }[] };
const templates = [
  { name: "Studio portfolio", prompt: "A polished creative studio portfolio with a dark editorial layout, case studies, testimonials and a contact form." },
  { name: "SaaS launch", prompt: "A conversion-focused SaaS landing page with pricing, feature comparison, customer logos, FAQ and a clear call to action." },
  { name: "Local cafe", prompt: "A warm modern cafe website with menu sections, opening hours, location map, photo gallery and online reservation call to action." },
];

const slug = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const [prompt, setPrompt] = useState("");
  const [projectName, setProjectName] = useState("");
  const [aiProvider, setAiProvider] = useState("openai");
  const [aiApiKey, setAiApiKey] = useState("");
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [usage, setUsage] = useState({ used: 0, limit: 20 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [router, status]);

  useEffect(() => {
    const token = session?.user?.accessToken;
    if (!apiUrl || !token) return;
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${apiUrl}/ai/projects`, { headers }).then((res) => res.json()),
      fetch(`${apiUrl}/auth/me`, { headers }).then((res) => res.json()),
      fetch(`${apiUrl}/ai/analytics`, { headers }).then((res) => res.json()),
    ]).then(([projectData, meData, analyticsData]) => {
      setProjects(projectData.projects || []);
      setUsage({ used: meData.user?.apiUsage || 0, limit: 20 });
      setAnalytics(analyticsData.analytics || null);
    }).catch(() => setError("Dashboard data could not be loaded."));
  }, [apiUrl, session?.user?.accessToken]);

  const generate = async () => {
    const token = session?.user?.accessToken;
    if (!apiUrl || !token || projectName.trim().length < 2 || prompt.trim().length < 5) {
      setError("Please enter a project name and describe your website in at least 5 characters.");
      return;
    }
    setIsGenerating(true);
    setError("");
    setMessage("");
    setFiles([]);
    const steps = ["Analyzing your brief...", "Writing app/page.tsx...", "Building components...", "Checking generated files..."];
    let index = 0;
    setProgress(steps[0]);
    const timer = window.setInterval(() => {
      index = Math.min(index + 1, steps.length - 1);
      setProgress(steps[index]);
    }, 1400);
    try {
      const response = await fetch(`${apiUrl}/ai/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt, aiProvider, aiApiKey: aiApiKey.trim() || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generation failed");
      setFiles(data.files || []);
      setUsage((current) => ({ ...current, used: current.used + 1 }));
      setMessage(`Generated ${data.files?.length || 0} files with ${data.provider}.`);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Generation failed.");
    } finally {
      window.clearInterval(timer);
      setProgress("");
      setIsGenerating(false);
    }
  };

  const save = async () => {
    const token = session?.user?.accessToken;
    if (!apiUrl || !token || files.length === 0) return;
    setIsSaving(true);
    try {
      const response = await fetch(`${apiUrl}/ai/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: projectName.trim(), prompt, files }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save project");
      setProjects((current) => [data.project, ...current]);
      setMessage("Project saved successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save project.");
    } finally {
      setIsSaving(false);
    }
  };

  if (status === "loading" || !session) return null;
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0a0a0f] to-[#1a1a2e] px-4 py-6 pt-20 text-white sm:p-8 sm:pt-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div><h1 className="text-3xl font-bold gradient-text">Welcome back, {session.user.name || "User"}!</h1><p className="mt-1 text-gray-400">Build websites with AI in minutes.</p></div>
          <span className="rounded-full border border-cyan-500/30 px-3 py-1 text-sm text-cyan-300">Free plan</span>
        </div>
        <section className="glass mb-8 rounded-2xl p-6">
          <h2 className="mb-4 text-xl font-semibold">Create a Website</h2>
          <div className="flex flex-col gap-4">
            <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Project name, e.g. Aria Photography" className="rounded-lg bg-black/20 p-3 outline-none" />
            <div className="grid gap-3 md:grid-cols-[180px_1fr_220px]">
              <select value={aiProvider} onChange={(event) => setAiProvider(event.target.value)} className="rounded-lg bg-[#171722] p-3 text-sm outline-none">
                <option value="gemini">Gemini</option><option value="openai">OpenAI</option><option value="groq">Groq</option><option value="openrouter">OpenRouter</option><option value="deepseek">DeepSeek</option>
              </select>
              <input type="password" value={aiApiKey} onChange={(event) => setAiApiKey(event.target.value)} placeholder="Optional: use your own API key" className="rounded-lg bg-black/20 p-3 text-sm outline-none md:col-span-2" />
            </div>
            <p className="text-xs text-gray-500">Your key is used only for this generation request and is not saved.</p>
            <div><textarea maxLength={1500} rows={10} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder='Describe your website, pages, style, colors and features...' className="min-h-[280px] w-full resize-y rounded-lg bg-black/20 p-4 outline-none" /><div className="mt-1 text-right text-xs text-gray-500">{prompt.length}/1500</div></div>
            <button onClick={generate} disabled={isGenerating} className="h-8 self-start rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 px-5 text-sm font-semibold disabled:opacity-60">{isGenerating ? "Generating..." : "Generate"}</button>
          </div>
          {progress && <div className="mt-5 flex items-center gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm text-cyan-200"><span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" /><span>{progress}</span><span className="text-gray-400">AI is preparing your files. This can take a moment.</span></div>}
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          {message && <p className="mt-3 text-sm text-emerald-400">{message}</p>}
          <div className="mt-4 flex justify-between text-xs text-gray-400"><span>AI requests remaining today</span><span>{Math.max(usage.limit - usage.used, 0)} / {usage.limit}</span></div>
          {files.length > 0 && <div className="mt-6"><div className="mb-3 flex justify-between"><h3 className="font-semibold">Generated files</h3><button onClick={save} disabled={isSaving} className="rounded-lg bg-emerald-500/20 px-4 py-2 text-emerald-300">{isSaving ? "Saving..." : "Save project"}</button></div><div className="grid gap-3 md:grid-cols-2">{files.map((file) => <details key={file.path} className="rounded-lg bg-black/20 p-3"><summary className="cursor-pointer text-cyan-300">{file.path}</summary><pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-gray-300">{file.content}</pre></details>)}</div></div>}
        </section>
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(analytics ? [
            ["Projects", analytics.totals.projects, "created"],
            ["Files", analytics.totals.files, "generated"],
            ["Versions", analytics.totals.versions, "saved"],
            ["AI requests", analytics.totals.aiRequests, "this period"],
          ] : []).map(([label, value, caption]) => <div key={label} className="glass rounded-2xl p-5"><p className="text-sm text-gray-400">{label}</p><p className="mt-2 text-3xl font-bold text-white">{value}</p><p className="mt-1 text-xs text-cyan-300">{caption}</p></div>)}
        </section>
        {analytics && <section className="glass mb-8 rounded-2xl p-6">
          <div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Workspace activity</h2><p className="mt-1 text-sm text-gray-400">Your real project and version activity over the last seven days.</p></div><span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">{analytics.totals.previews} previews</span></div>
          <div className="mt-6 flex h-44 items-end gap-2 sm:gap-4">{analytics.days.map((day) => { const height = Math.max(day.projects * 22 + day.edits * 8, 8); return <div key={day.label} className="flex flex-1 flex-col items-center gap-2"><div className="flex h-36 w-full items-end justify-center rounded-t-lg bg-white/[0.03]"><div title={`${day.projects} projects, ${day.edits} edits`} className="w-3/5 rounded-t-md bg-gradient-to-t from-purple-600 to-cyan-400 transition-all" style={{ height: `${Math.min(height, 100)}%` }} /></div><span className="text-xs text-gray-500">{day.label}</span></div>; })}</div>
        </section>}
        <section className="mb-8">
          <div className="mb-4 flex items-end justify-between"><div><h2 className="text-xl font-semibold">Start from a template</h2><p className="mt-1 text-sm text-gray-400">Use a proven brief and customize it with AI.</p></div></div>
          <div className="grid gap-3 md:grid-cols-3">{templates.map((template) => <button key={template.name} onClick={() => { setProjectName(template.name); setPrompt(template.prompt); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="glass rounded-2xl p-5 text-left transition hover:-translate-y-1 hover:border-cyan-400/50"><div className="mb-4 h-20 rounded-xl bg-gradient-to-br from-cyan-400/20 to-purple-600/30" /><h3 className="font-semibold text-cyan-200">{template.name}</h3><p className="mt-2 line-clamp-2 text-sm text-gray-400">{template.prompt}</p></button>)}</div>
        </section>
        <h2 className="mb-4 text-xl font-semibold">Your Projects</h2>
        <div className="grid gap-4 md:grid-cols-2">{projects.map((project) => <Link key={project.id} href={`/project/${slug(project.name)}`} className="glass rounded-2xl p-5 hover:border-cyan-400/50"><h3 className="font-semibold text-cyan-300">{project.name}</h3><p className="mt-2 line-clamp-2 text-sm text-gray-400">{project.prompt}</p><p className="mt-4 text-xs text-gray-500">{project.status}</p></Link>)}</div>
      </div>
    </main>
  );
}
