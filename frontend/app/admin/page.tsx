"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AdminContactPanel from "./AdminContactPanel";
import Link from "next/link";
import { MessageSquare } from "lucide-react";

type AdminUser = {
  id: string;
  name?: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  projectCount: number;
  apiUsage: number;
  apiRemaining: number;
  profilePic?: string | null; // ✅ added
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null); // ✅ modal

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (!session?.user.accessToken || session.user.role !== "adminasad90")
      return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${session.user.accessToken}` },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Admin access denied");
        return data;
      })
      .then((data) => setUsers(data.users || []))
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Admin access denied",
        ),
      );
  }, [router, session?.user.accessToken, session?.user.role, status]);

  if (status === "loading" || !session) return null;

  if (session.user.role !== "adminasad90")
    return (
      <main className="min-h-screen bg-[#0a0a0f] p-8 pt-28 text-white">
        <h1 className="text-2xl font-bold">Access denied</h1>
      </main>
    );

  return (
    <main className="min-h-screen bg-[#0a0a0f] p-8 pt-28 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-400 mt-2">Manage users and requests</p>
          </div>
          <Link
            href="/admin/chat"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 font-semibold hover:scale-105 transition"
          >
            <MessageSquare className="w-4 h-4" />
            Open Chats
          </Link>
        </div>

        <AdminContactPanel onImageClick={setPreviewImage} />

        {/* Users Table */}
        <h1 className="text-3xl font-bold mt-10">Admin users</h1>
        <p className="mt-2 text-gray-400">
          Account activity and workspace usage.
        </p>

        {error && <p className="mt-4 text-red-400">{error}</p>}

        <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-white/5 text-gray-400">
              <tr>
                <th className="p-4">Sr. No.</th>
                <th className="p-4">Pic</th>
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Projects</th>
                <th className="p-4">API used</th>
                <th className="p-4">API remaining</th>
                <th className="p-4">Status</th>
                <th className="p-4">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr key={user.id} className="border-t border-white/10">
                  <td className="p-4 text-gray-500">{index + 1}</td>
                  <td className="p-4">
                    <img
                      src={user.profilePic || "/default-avatar.png"}
                      alt={user.name || "user"}
                      className="w-14 h-14 rounded-full object-cover cursor-pointer border border-white/20 hover:scale-105 transition"
                      onClick={() =>
                        setPreviewImage(user.profilePic || "/default-avatar.png")
                      }
                    />
                  </td>
                  <td className="p-4">{user.name || "—"}</td>
                  <td className="p-4">{user.email}</td>
                  <td className="p-4 text-cyan-300">{user.projectCount}</td>
                  <td className="p-4">{user.apiUsage}/20</td>
                  <td className="p-4 text-emerald-300">{user.apiRemaining}</td>
                  <td
                    className={`p-4 ${user.isActive ? "text-emerald-300" : "text-red-300"}`}
                  >
                    {user.isActive ? "Active" : "Deleted"}
                  </td>
                  <td className="p-4 text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ✅ Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-3xl max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage}
              alt="preview"
              className="max-w-full max-h-[85vh] rounded-2xl border border-white/20 shadow-2xl"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white text-black font-bold hover:bg-gray-200 transition"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </main>
  );
}