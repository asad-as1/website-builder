"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Project = { id: string; name: string; prompt: string; status: string };
const slug = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project";

export default function ProjectsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (!apiUrl || !session?.user.accessToken) return;
    fetch(`${apiUrl}/ai/projects`, { headers: { Authorization: "Bearer " + session.user.accessToken } })
      .then((response) => response.json())
      .then((data) => setProjects(data.projects || []));
  }, [apiUrl, router, session?.user.accessToken, status]);

  if (!session) return null;
  return (
    <main className="min-h-screen bg-[#0a0a0f] px-6 pb-16 pt-24 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold">Your Projects</h1>
        <p className="mt-2 text-gray-400">Open and continue editing your generated websites.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <Link key={project.id} href={`/project/${slug(project.name)}`} className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-cyan-400/50">
              <h2 className="font-semibold text-cyan-300">{project.name}</h2>
              <p className="mt-2 line-clamp-2 text-sm text-gray-400">{project.prompt}</p>
              <p className="mt-4 text-xs text-gray-500">{project.status}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
