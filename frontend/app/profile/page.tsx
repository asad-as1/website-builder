"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

type Project = { id: string; name: string; prompt: string; status: string; createdAt?: string };

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    if (!session?.user.accessToken || !apiUrl) return;
    fetch(`${apiUrl}/ai/projects`, { headers: { Authorization: `Bearer ${session.user.accessToken}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load project history");
        return data;
      })
      .then((data) => setProjects(data.projects || []))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load project history"));
  }, [apiUrl, session?.user.accessToken]);

  if (status === "loading" || !session) return null;
  const user = session.user;

  const deleteAccount = async () => {
    try {
      const response = await fetch(`${apiUrl}/auth/delete-account`, { method: "DELETE", headers: { Authorization: `Bearer ${user.accessToken}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete account");
      await signOut({ callbackUrl: "/" });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete account");
      setConfirming(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#080812] via-[#111126] to-[#0a0a0f] px-6 pb-16 pt-24 text-white">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-transparent p-8 shadow-2xl shadow-purple-950/30">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
            {user.image ? <img src={user.image} alt="" className="h-24 w-24 rounded-3xl object-cover ring-4 ring-white/10" /> : <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-400 to-purple-600 text-4xl font-bold">{(user.name || "U").charAt(0).toUpperCase()}</div>}
            <div><p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Genetix account</p><h1 className="mt-2 text-4xl font-bold">{user.name || "User"}</h1><p className="mt-1 text-gray-300">{user.email}</p></div>
            <span className="md:ml-auto rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300">Active account</span>
          </div>
        </section>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-sm text-gray-400">Projects created</p><p className="mt-2 text-3xl font-bold">{projects.length}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-sm text-gray-400">Account type</p><p className="mt-2 text-3xl font-bold capitalize">{user.provider === "google" ? "Google" : "Email"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-sm text-gray-400">Workspace status</p><p className="mt-2 text-3xl font-bold text-emerald-300">Active</p></div>
        </div>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between"><div><h2 className="text-2xl font-semibold">Project history</h2><p className="mt-1 text-sm text-gray-400">Your recent AI-generated workspaces.</p></div><Link href="/dashboard" className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm text-cyan-300">Create new</Link></div>
          {projects.length === 0 ? <p className="mt-8 rounded-xl bg-black/20 p-6 text-center text-gray-400">Your project history will appear here.</p> : <div className="mt-6 grid gap-3 md:grid-cols-2">{projects.slice(0, 6).map((project) => <Link href={`/project/${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} key={project.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-cyan-400/40"><div className="flex items-center justify-between"><h3 className="font-semibold text-cyan-300">{project.name}</h3><span className="text-xs text-emerald-300">{project.status}</span></div><p className="mt-2 line-clamp-2 text-sm text-gray-400">{project.prompt}</p>{project.createdAt && <p className="mt-3 text-xs text-gray-500">{new Date(project.createdAt).toLocaleDateString()}</p>}</Link>)}</div>}
        </section>

        {error && <p className="mt-6 text-sm text-red-400">{error}</p>}
        <button onClick={() => setConfirming(true)} className="mt-8 rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-300">Delete account</button>
      </div>
      {confirming && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#171722] p-6"><h2 className="text-xl font-semibold">Delete account?</h2><p className="mt-3 text-sm text-gray-400">Your account will be deactivated and you will be signed out.</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => setConfirming(false)} className="rounded-lg bg-white/10 px-4 py-2">Cancel</button><button onClick={deleteAccount} className="rounded-lg bg-red-500 px-4 py-2 font-semibold">Delete account</button></div></div></div>}
    </main>
  );
}
