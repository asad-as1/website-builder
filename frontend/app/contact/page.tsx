"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { Send, CheckCircle, AlertCircle, History, ChevronDown } from "lucide-react";

type Project = { id: string; name: string };

export default function ContactPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [formData, setFormData] = useState({
    projectId: "",
    changes: "",
    budget: "₹500 - ₹1000",
    priority: "normal",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session?.user?.accessToken) return;
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/ai/projects`, {
        headers: { Authorization: `Bearer ${session.user.accessToken}` },
      })
      .then((res) => setProjects(res.data.projects || []))
      .catch(() => {});
  }, [session?.user?.accessToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.accessToken) return;

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/contact`,
        formData,
        { headers: { Authorization: `Bearer ${session.user.accessToken}` } }
      );
      setSuccess(response.data.message);
      setFormData({
        projectId: "",
        changes: "",
        budget: "₹500 - ₹1000",
        priority: "normal",
      });
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to send request");
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white p-4 pt-24">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 relative">
          <h1 className="text-4xl font-bold gradient-text mb-3">
            Need Custom Changes?
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Tell us what changes you want in your generated project, and we'll
            get back to you with a quote.
          </p>
          <Link
            href="/contact/history"
            className="absolute top-0 right-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition"
          >
            <History className="w-4 h-4" />
            My Requests
          </Link>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass p-8 rounded-2xl space-y-6"
        >
          {/* User Info */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Name</label>
              <input
                type="text"
                value={session?.user?.name || ""}
                disabled
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Email</label>
              <input
                type="email"
                value={session?.user?.email || ""}
                disabled
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Project Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Select Project (optional)
            </label>
            <div className="relative">
              <select
                value={formData.projectId}
                onChange={(e) =>
                  setFormData({ ...formData, projectId: e.target.value })
                }
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white appearance-none focus:outline-none focus:border-cyan-400 cursor-pointer pr-10"
              >
                <option value="" className="bg-[#1a1a2e] text-white">
                  -- General Request --
                </option>
                {projects.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    className="bg-[#1a1a2e] text-white"
                  >
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Changes */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Changes Required *
            </label>
            <textarea
              value={formData.changes}
              onChange={(e) =>
                setFormData({ ...formData, changes: e.target.value })
              }
              rows={5}
              placeholder="Describe what changes you want in your project..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 resize-none"
              required
            />
          </div>

          {/* Budget + Priority */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Budget Range *
              </label>
              <div className="relative">
                <select
                  value={formData.budget}
                  onChange={(e) =>
                    setFormData({ ...formData, budget: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white appearance-none focus:outline-none focus:border-cyan-400 cursor-pointer pr-10"
                >
                  <option className="bg-[#1a1a2e] text-white">₹500 - ₹1000</option>
                  <option className="bg-[#1a1a2e] text-white">₹1000 - ₹5000</option>
                  <option className="bg-[#1a1a2e] text-white">₹5000 - ₹10000</option>
                  <option className="bg-[#1a1a2e] text-white">₹10000+</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Priority
              </label>
              <div className="relative">
                <select
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white appearance-none focus:outline-none focus:border-cyan-400 cursor-pointer pr-10"
                >
                  <option value="low" className="bg-[#1a1a2e] text-white">
                    🟢 Low
                  </option>
                  <option value="normal" className="bg-[#1a1a2e] text-white">
                    🟡 Normal
                  </option>
                  <option value="urgent" className="bg-[#1a1a2e] text-white">
                    🔴 Urgent
                  </option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg font-semibold hover:scale-105 transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? (
              "Sending..."
            ) : (
              <>
                <Send className="w-4 h-4" /> Send Request
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}