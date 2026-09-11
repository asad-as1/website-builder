"use client";

import { useEffect, useState } from "react";

type SharedProject = { name: string; prompt: string; files: { path: string; content: string }[]; thumbnail?: { emoji?: string; gradient?: string } };

export default function SharedProjectPage({ params }: { params: Promise<{ token: string }> }) {
  const [project, setProject] = useState<SharedProject | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    params.then(({ token }) => fetch(`${process.env.NEXT_PUBLIC_API_URL}/ai/shared/${token}`)
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data.project; })
      .then(setProject)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Shared project unavailable")));
  }, [params]);
  if (error) return <main className="min-h-screen bg-[#0a0a0f] p-10 pt-24 text-center text-red-300">{error}</main>;
  if (!project) return <main className="min-h-screen bg-[#0a0a0f] p-10 pt-24 text-center text-gray-400">Loading shared project...</main>;
  const html = project.files.find((file) => file.path.endsWith(".html"))?.content;
  return <main className="min-h-screen bg-[#0a0a0f] px-4 py-10 pt-24 text-white"><div className="mx-auto max-w-5xl"><div className={`mb-6 flex h-32 items-center justify-center rounded-3xl bg-gradient-to-br ${project.thumbnail?.gradient || "from-cyan-500/20 to-purple-600/30"}`}><span className="text-6xl">{project.thumbnail?.emoji || "✦"}</span></div><h1 className="text-3xl font-bold">{project.name}</h1><p className="mt-2 text-gray-400">{project.prompt}</p>{html ? <iframe title={`${project.name} preview`} sandbox="" srcDoc={html} className="mt-8 h-[70vh] w-full rounded-2xl bg-white" /> : <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6"><h2 className="font-semibold">Generated files</h2><ul className="mt-4 space-y-2 text-sm text-cyan-200">{project.files.map((file) => <li key={file.path}>{file.path}</li>)}</ul><p className="mt-5 text-xs text-gray-500">Open this project in Genetix to run the full Next.js preview.</p></div>}</div></main>;
}
