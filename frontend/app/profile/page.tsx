"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import axios from "axios";
import { Camera, X, Loader2 } from "lucide-react";

type Project = { id: string; name: string; prompt: string; status: string; createdAt?: string };

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  // ✅ Avatar update state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

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

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAvatarError("Only images allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Max 5MB allowed");
      return;
    }

    setAvatarFile(file);
    setAvatarError("");
    setAvatarSuccess("");
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const cancelAvatarChange = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarError("");
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const handleAvatarUpdate = async () => {
    if (!avatarFile || !user.accessToken || !apiUrl) return;

    setIsUploading(true);
    setAvatarError("");
    setAvatarSuccess("");

    try {
      const formData = new FormData();
      formData.append("avatar", avatarFile);

      const response = await axios.put(
        `${apiUrl}/auth/avatar`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${user.accessToken}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const newAvatarUrl = response.data.avatar;

      setAvatarSuccess("Profile picture updated!");
      setAvatarFile(null);
      setAvatarPreview(null);

      // ✅ Pass new avatar URL to update() — NextAuth jwt callback will refresh from backend
      await update({ image: newAvatarUrl });
    } catch (err: any) {
      setAvatarError(err.response?.data?.error || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

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

  const currentAvatar = avatarPreview || user.image;

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#080812] via-[#111126] to-[#0a0a0f] px-6 pb-16 pt-24 text-white">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-transparent p-8 shadow-2xl shadow-purple-950/30">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
            <div className="relative shrink-0">
              <input
                ref={avatarInputRef}
                type="file"
                hidden
                accept="image/*"
                onChange={handleAvatarSelect}
              />
              {currentAvatar ? (
                <img
                  src={currentAvatar}
                  alt=""
                  key={currentAvatar}
                  className="h-24 w-24 rounded-3xl object-cover ring-4 ring-white/10"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-400 to-purple-600 text-4xl font-bold">
                  {(user.name || "U").charAt(0).toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploading}
                className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:scale-110 transition shadow-lg disabled:opacity-50"
                title="Change profile picture"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Genetix account</p>
              <h1 className="mt-2 text-4xl font-bold">{user.name || "User"}</h1>
              <p className="mt-1 text-gray-300">{user.email}</p>
            </div>
            <span className="md:ml-auto rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300">Active account</span>
          </div>

          {avatarFile && (
            <div className="relative mt-4 flex items-center gap-2 flex-wrap">
              <button
                onClick={handleAvatarUpdate}
                disabled={isUploading}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
              >
                {isUploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : "Save picture"}
              </button>
              <button
                onClick={cancelAvatarChange}
                disabled={isUploading}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          )}
          {avatarSuccess && <p className="relative mt-3 text-sm text-emerald-400">{avatarSuccess}</p>}
          {avatarError && <p className="relative mt-3 text-sm text-red-400">{avatarError}</p>}
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