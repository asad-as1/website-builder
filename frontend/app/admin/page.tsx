"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AdminContactPanel from "./AdminContactPanel";
import Link from "next/link";
import { MessageSquare, RefreshCw } from "lucide-react";

const getAvatar = (url?: string | null, name?: string, email?: string) => {
  if (url && url.trim().length > 0) return url;
  const initial = (name || email || "U").trim().charAt(0).toUpperCase();
  return `https://ui-avatars.com/api/?background=0a0a0f&color=22d3ee&bold=true&name=${encodeURIComponent(initial)}`;
};

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
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [error, setError] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null); // ✅ modal
  const [userFilter, setUserFilter] = useState<"all" | "active" | "deleted">("all");
  const [userPage, setUserPage] = useState(1);
  const USERS_PER_PAGE = 10;

  const fetchUsers = () => {
    if (!session?.user.accessToken || session.user.role !== "admin") return;
    setIsLoadingUsers(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${session.user.accessToken}` },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Admin access denied");
        return data;
      })
      .then((data) => {
        setUsers(data.users || []);
        setError("");
      })
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Admin access denied",
        ),
      )
      .finally(() => setIsLoadingUsers(false));
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (!session?.user.accessToken || session.user.role !== "admin") return;
    fetchUsers();
  }, [router, session?.user.accessToken, session?.user.role, status]);

  if (status === "loading" || !session) return null;

  if (session.user.role !== "admin")
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

        {/* Users Table Header & Filters */}
        <div className="mt-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Admin users</h1>
            <p className="mt-2 text-gray-400">
              Account activity and workspace usage.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
              <button
                onClick={() => { setUserFilter("all"); setUserPage(1); }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  userFilter === "all" ? "bg-cyan-500 text-white shadow-lg" : "text-gray-400 hover:text-white"
                }`}
              >
                All ({users.length})
              </button>
              <button
                onClick={() => { setUserFilter("active"); setUserPage(1); }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  userFilter === "active" ? "bg-emerald-500 text-white shadow-lg" : "text-gray-400 hover:text-white"
                }`}
              >
                Active ({users.filter((u) => u.isActive).length})
              </button>
              <button
                onClick={() => { setUserFilter("deleted"); setUserPage(1); }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  userFilter === "deleted" ? "bg-red-500 text-white shadow-lg" : "text-gray-400 hover:text-white"
                }`}
              >
                Deleted ({users.filter((u) => !u.isActive).length})
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchUsers}
              className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingUsers ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {error && <p className="mt-4 text-red-400">{error}</p>}

        {(() => {
          const filtered = users.filter((u) => {
            if (userFilter === "active") return u.isActive;
            if (userFilter === "deleted") return !u.isActive;
            return true;
          });
          const totalPages = Math.ceil(filtered.length / USERS_PER_PAGE) || 1;
          const paginated = filtered.slice((userPage - 1) * USERS_PER_PAGE, userPage * USERS_PER_PAGE);

          return (
            <>
              <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
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
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-gray-500">
                          No {userFilter === "all" ? "" : userFilter} users found.
                        </td>
                      </tr>
                    ) : (
                      paginated.map((user, index) => {
                        const serialNumber = (userPage - 1) * USERS_PER_PAGE + index + 1;
                        const avatar = getAvatar(user.profilePic, user.name, user.email);
                        const fallbackUrl = getAvatar(null, user.name, user.email);
                        return (
                          <tr key={user.id} className="border-t border-white/10 hover:bg-white/[0.02] transition">
                            <td className="p-4 text-gray-500">{serialNumber}</td>
                            <td className="p-4">
                              <img
                                src={avatar}
                                alt={user.name || "user"}
                                className="w-14 h-14 rounded-full object-cover cursor-pointer border border-white/20 hover:scale-105 transition"
                                onClick={() => setPreviewImage(avatar)}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = fallbackUrl;
                                }}
                              />
                            </td>
                            <td className="p-4 font-medium">{user.name || "—"}</td>
                            <td className="p-4 font-mono text-xs">
                              {user.email}
                            </td>
                            <td className="p-4 text-cyan-300 font-semibold">{user.projectCount}</td>
                            <td className="p-4">{user.apiUsage}/20</td>
                            <td className="p-4 text-emerald-300">{user.apiRemaining}</td>
                            <td className="p-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  user.isActive
                                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                                    : "bg-red-500/10 border border-red-500/30 text-red-300"
                                }`}
                              >
                                {user.isActive ? "Active" : "Deleted"}
                              </span>
                            </td>
                            <td className="p-4 text-gray-400">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-xs text-gray-400 px-2">
                  <span>
                    Showing {(userPage - 1) * USERS_PER_PAGE + 1} -{" "}
                    {Math.min(userPage * USERS_PER_PAGE, filtered.length)} of {filtered.length} users
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setUserPage((p) => Math.max(p - 1, 1))}
                      disabled={userPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      Previous
                    </button>
                    <span className="font-semibold text-white px-2">
                      {userPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setUserPage((p) => Math.min(p + 1, totalPages))}
                      disabled={userPage === totalPages}
                      className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          );
        })()}
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