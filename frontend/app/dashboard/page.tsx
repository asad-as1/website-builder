"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  // ✅ Plan fix: fallback "free" if not available
  const userPlan = session.user?.plan || "free";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] to-[#1a1a2e] text-white p-8 pt-20">
      <div className="max-w-6xl mx-auto">
        {/* Header - Without Logout Button */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold gradient-text">
              Welcome back, {session.user?.name || "User"}! 👋
            </h1>
            <p className="text-gray-400 mt-1">
              Build websites with AI in minutes
            </p>
          </div>
          {/* Plan Badge - Without Emoji */}
          {userPlan === "free" ? (
            <span className="px-3 py-1 text-sm border border-white/10 text-gray-400 rounded-full">
              Free
            </span>
          ) : (
            <span className="px-3 py-1 text-sm border border-amber-500/30 text-amber-400 rounded-full">
              Pro
            </span>
          )}
        </div>

        {/* AI Prompt Section */}
        <div className="glass p-6 rounded-2xl mb-8">
          <h2 className="text-xl font-semibold mb-4">🚀 Create a Website</h2>
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder='e.g., "A portfolio for a photographer"'
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
            />
            <button className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg font-semibold hover:scale-105 transition whitespace-nowrap">
              Generate
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="text-xs text-gray-400">Templates:</span>
            <button className="px-3 py-1 text-xs bg-white/5 rounded-full hover:bg-white/10 transition">
              Portfolio
            </button>
            <button className="px-3 py-1 text-xs bg-white/5 rounded-full hover:bg-white/10 transition">
              Restaurant
            </button>
            <button className="px-3 py-1 text-xs bg-white/5 rounded-full hover:bg-white/10 transition">
              Agency
            </button>
            <button className="px-3 py-1 text-xs bg-white/5 rounded-full hover:bg-white/10 transition">
              Blog
            </button>
          </div>
        </div>

        {/* Projects Grid */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">📁 Your Projects</h2>
            <span className="text-sm text-gray-400">0 projects</span>
          </div>
          <div className="glass p-8 rounded-2xl text-center border border-dashed border-white/10">
            <p className="text-gray-400">No projects yet.</p>
            <p className="text-gray-500 text-sm mt-1">
              Generate your first website using the prompt above!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
