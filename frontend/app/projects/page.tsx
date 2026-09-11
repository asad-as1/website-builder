"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ConfirmationModal from "@/components/shared/ConfirmationModal";

type Project = { id: string; name: string; prompt: string; status: string; thumbnail?: { emoji?: string; gradient?: string }; updatedAt?: string };
const slug = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project";

export default function ProjectsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [deleting, setDeleting] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [duplicating, setDuplicating] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (!apiUrl || !session?.user.accessToken) return;
    fetch(`${apiUrl}/ai/projects`, { headers: { Authorization: "Bearer " + session.user.accessToken } })
      .then((response) => response.json())
      .then((data) => setProjects(data.projects || []));
  }, [apiUrl, router, session?.user.accessToken, status]);

  if (!session) return null;
  const deleteProject = async (projectId: string) => {
    setDeleting(projectId);
    const response = await fetch(`${apiUrl}/ai/projects/${projectId}`, { method: "DELETE", headers: { Authorization: "Bearer " + session.user.accessToken } });
    if (response.ok) setProjects((current) => current.filter((project) => project.id !== projectId));
    setDeleting("");
    setSelectedProject(null);
  };
  const duplicateProject = async (projectId: string) => {
    setDuplicating(projectId);
    const response = await fetch(`${apiUrl}/ai/projects/${projectId}/duplicate`, { method: "POST", headers: { Authorization: "Bearer " + session.user.accessToken } });
    const data = await response.json();
    if (response.ok) setProjects((current) => [data.project, ...current]);
    setDuplicating("");
  };
  const visibleProjects = projects.filter((project) => {
    const matchesQuery = `${project.name} ${project.prompt}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (filter === "all" || project.status === filter);
  });
  return (
    <main className="min-h-screen bg-[#0a0a0f] px-6 pb-16 pt-24 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold">Your Projects</h1>
        <p className="mt-2 text-gray-400">Open and continue editing your generated websites.</p>
        {projects.length > 0 && <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-cyan-400" />
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-xl border border-white/10 bg-[#171722] px-4 py-3 text-sm text-gray-300 outline-none">
            <option value="all">All statuses</option><option value="completed">Completed</option><option value="draft">Draft</option>
          </select>
        </div>}
        {projects.length === 0 ? (
          <section className="mt-10 overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-white/5 p-10 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-400 to-purple-600 text-4xl">✦</div>
            <h2 className="mt-6 text-2xl font-bold">Build your first website</h2>
            <p className="mx-auto mt-3 max-w-lg text-gray-400">Your workspace is ready. Describe your idea and Genetix will turn it into a working website you can edit and preview.</p>
            <Link href="/dashboard" className="mt-7 inline-flex rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-6 py-3 font-semibold">Start building</Link>
          </section>
        ) : <div className="mt-8 grid gap-4 md:grid-cols-2">
          {visibleProjects.map((project) => (
            <article key={project.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/50">
              <Link href={`/project/${slug(project.name)}`} className="block">
                <div className={`mb-4 flex h-24 items-center justify-center rounded-xl bg-gradient-to-br ${project.thumbnail?.gradient || "from-cyan-500/20 to-purple-600/20"}`}><span className="text-4xl">{project.thumbnail?.emoji || "✦"}</span></div>
                <h2 className="font-semibold text-cyan-300">{project.name}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-gray-400">{project.prompt}</p>
                <p className="mt-4 text-xs text-gray-500">{project.status}</p>
              </Link>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href={`/editor/${slug(project.name)}`} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/10">Edit project</Link>
                <button onClick={() => duplicateProject(project.id)} disabled={duplicating === project.id} className="rounded-lg border border-cyan-400/30 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-500/10">{duplicating === project.id ? "Duplicating..." : "Duplicate"}</button>
                <button onClick={() => setSelectedProject(project)} disabled={deleting === project.id} className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/10">Delete</button>
              </div>
            </article>
          ))}
        </div>}
      </div>
      <ConfirmationModal isOpen={Boolean(selectedProject)} title="Delete this project?" description="This permanently removes the project and its version history." confirmLabel="Delete project" isBusy={Boolean(selectedProject && deleting === selectedProject.id)} onClose={() => setSelectedProject(null)} onConfirm={() => selectedProject && (setDeleting(selectedProject.id), deleteProject(selectedProject.id))} />
    </main>
  );
}
