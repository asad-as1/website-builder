"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import axios from "axios";
import ConfirmationModal from "@/components/shared/ConfirmationModal";
import { Image as ImageIcon, Upload, X, Loader2 } from "lucide-react";

type Project = {
  id: string;
  name: string;
  prompt: string;
  status: string;
  thumbnail?: { emoji?: string; gradient?: string; previewUrl?: string };
  thumbnailImage?: string | null;
  updatedAt?: string;
};

const slug = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";

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

  // ✅ Thumbnail edit state
  const [thumbProject, setThumbProject] = useState<Project | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [thumbError, setThumbError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (!apiUrl || !session?.user.accessToken) return;
    fetch(`${apiUrl}/ai/projects`, {
      headers: { Authorization: "Bearer " + session.user.accessToken },
    })
      .then((response) => response.json())
      .then((data) => setProjects(data.projects || []));
  }, [apiUrl, router, session?.user.accessToken, status]);

  if (!session) return null;

  const deleteProject = async (projectId: string) => {
    setDeleting(projectId);
    const response = await fetch(`${apiUrl}/ai/projects/${projectId}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + session.user.accessToken },
    });
    if (response.ok)
      setProjects((current) =>
        current.filter((project) => project.id !== projectId),
      );
    setDeleting("");
    setSelectedProject(null);
  };

  const duplicateProject = async (projectId: string) => {
    setDuplicating(projectId);
    const response = await fetch(
      `${apiUrl}/ai/projects/${projectId}/duplicate`,
      {
        method: "POST",
        headers: { Authorization: "Bearer " + session.user.accessToken },
      },
    );
    const data = await response.json();
    if (response.ok) setProjects((current) => [data.project, ...current]);
    setDuplicating("");
  };

  // ✅ Thumbnail handlers
  const openThumbModal = (project: Project) => {
    setThumbProject(project);
    setSelectedFile(null);
    setPreview(null);
    setThumbError("");
  };

  const closeThumbModal = () => {
    setThumbProject(null);
    setSelectedFile(null);
    setPreview(null);
    setThumbError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setThumbError("Only images allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setThumbError("Max 5MB allowed");
      return;
    }

    setSelectedFile(file);
    setThumbError("");

    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleThumbnailUpload = async () => {
    if (!selectedFile || !thumbProject || !session?.user.accessToken) return;

    setIsUploading(true);
    setThumbError("");

    try {
      const formData = new FormData();
      formData.append("thumbnail", selectedFile);

      const response = await axios.put(
        `${apiUrl}/ai/projects/${thumbProject.id}/thumbnail`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${session.user.accessToken}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      // ✅ Update local state
      setProjects((current) =>
        current.map((p) =>
          p.id === thumbProject.id
            ? { ...p, thumbnailImage: response.data.thumbnailImage }
            : p
        )
      );

      closeThumbModal();
    } catch (err: any) {
      setThumbError(err.response?.data?.error || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const visibleProjects = projects.filter((project) => {
    const matchesQuery = `${project.name} ${project.prompt}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesQuery && (filter === "all" || project.status === filter);
  });

  return (
    <main className="min-h-screen bg-[#0a0a0f] px-6 pb-16 pt-24 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold">Your Projects</h1>
        <p className="mt-2 text-gray-400">
          Open and continue editing your generated websites.
        </p>
        {projects.length > 0 && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects..."
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-cyan-400"
            />
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#171722] px-4 py-3 text-sm text-gray-300 outline-none"
            >
              <option value="all">All statuses</option>
              <option value="completed">Completed</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        )}
        {projects.length === 0 ? (
          <section className="mt-10 overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-white/5 p-10 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-400 to-purple-600 text-4xl">
              ✦
            </div>
            <h2 className="mt-6 text-2xl font-bold">
              Build your first website
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-gray-400">
              Your workspace is ready. Describe your idea and Genetix will turn
              it into a working website you can edit and preview.
            </p>
            <Link
              href="/dashboard"
              className="mt-7 inline-flex rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-6 py-3 font-semibold"
            >
              Start building
            </Link>
          </section>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {visibleProjects.map((project) => (
              <article
                key={project.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/50"
              >
                <Link href={`/project/${slug(project.name)}`} className="block">
                  <div
                    className={`group relative mb-4 flex h-40 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br ${project.thumbnail?.gradient || "from-cyan-500/20 to-purple-600/20"}`}
                  >
                    {/* ✅ Priority: thumbnailImage > previewUrl iframe > emoji */}
                    {project.thumbnailImage ? (
                      <img
                        src={project.thumbnailImage}
                        alt={`${project.name} thumbnail`}
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : project.thumbnail?.previewUrl ? (
                      <iframe
                        title={`${project.name} preview thumbnail`}
                        src={project.thumbnail.previewUrl}
                        loading="lazy"
                        className="pointer-events-none absolute inset-0 h-full w-full border-0 bg-white"
                      />
                    ) : (
                      <span className="text-4xl">
                        {project.thumbnail?.emoji || "✦"}
                      </span>
                    )}

                    {/* ✅ Edit thumbnail button — hover pe */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openThumbModal(project);
                      }}
                      className="absolute top-2 right-2 p-2 rounded-full bg-black/70 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition hover:bg-black/90 z-10"
                      title="Edit thumbnail"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <h2 className="font-semibold text-cyan-300">
                    {project.name}
                  </h2>
                  <p className="mt-2 line-clamp-2 text-sm text-gray-400">
                    {project.prompt}
                  </p>
                  <p className="mt-4 text-xs text-gray-500">{project.status}</p>
                </Link>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={`/editor/${slug(project.name)}`}
                    className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/10"
                  >
                    Edit project
                  </Link>
                  <button
                    onClick={() => duplicateProject(project.id)}
                    disabled={duplicating === project.id}
                    className="rounded-lg border border-cyan-400/30 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-500/10"
                  >
                    {duplicating === project.id
                      ? "Duplicating..."
                      : "Duplicate"}
                  </button>
                  <button
                    onClick={() => setSelectedProject(project)}
                    disabled={deleting === project.id}
                    className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={Boolean(selectedProject)}
        title="Delete this project?"
        description="This permanently removes the project and its version history."
        confirmLabel="Delete project"
        isBusy={Boolean(selectedProject && deleting === selectedProject.id)}
        onClose={() => setSelectedProject(null)}
        onConfirm={() =>
          selectedProject &&
          (setDeleting(selectedProject.id), deleteProject(selectedProject.id))
        }
      />

      {/* ✅ Edit Thumbnail Modal */}
      {thumbProject && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Edit Thumbnail</h3>
                <p className="text-xs text-gray-400 mt-0.5">{thumbProject.name}</p>
              </div>
              <button
                onClick={closeThumbModal}
                disabled={isUploading}
                className="p-2 rounded-lg hover:bg-white/10 transition disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* File input hidden */}
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept="image/*"
              onChange={handleFileSelect}
            />

            {preview ? (
              <div className="relative mb-4">
                <img
                  src={preview}
                  alt="preview"
                  className="w-full rounded-lg object-cover max-h-64"
                />
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  disabled={isUploading}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-black/90 transition disabled:opacity-40"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full mb-4 border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-cyan-400/40 hover:bg-white/[0.02] transition"
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Click to upload image</p>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG — Max 5MB</p>
              </button>
            )}

            {thumbError && (
              <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-xs text-center">{thumbError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={closeThumbModal}
                disabled={isUploading}
                className="flex-1 py-3 border border-white/10 rounded-lg text-gray-300 hover:bg-white/5 transition disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleThumbnailUpload}
                disabled={!selectedFile || isUploading}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Save Thumbnail"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}