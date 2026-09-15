"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

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
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
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
        <h1 className="text-3xl font-bold">Admin users</h1>
        <p className="mt-2 text-gray-400">
          Account activity and workspace usage.
        </p>
        {error && <p className="mt-4 text-red-400">{error}</p>}
        <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-white/5 text-gray-400">
              <tr>
                <th className="p-4">Sr. No.</th>
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
                  <td className="p-4">{user.name || "—"}</td>
                  <td className="p-4">{user.email}</td>
                  <td className="p-4 text-cyan-300">
                    {user.projectCount}
                  </td>
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
    </main>
  );
}
