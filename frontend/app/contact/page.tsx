"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { Send, CheckCircle, AlertCircle, History, ChevronDown, Check } from "lucide-react";

type Project = { id: string; name: string };

type DropdownOption = {
  value: string;
  label: string;
};

// Reusable custom dropdown — replaces the native <select> with a themed,
// keyboard/click-outside aware listbox. Purely presentational: it reports
// the chosen value the same way a native select's onChange would.
function CustomDropdown({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full px-4 py-3 bg-white/5 border rounded-lg text-left flex items-center justify-between gap-2 transition-colors ${
          open
            ? "border-cyan-400 bg-white/[0.07]"
            : "border-white/10 hover:border-white/20 hover:bg-white/[0.07]"
        }`}
      >
        <span className={selected ? "text-white" : "text-gray-500"}>
          {selected ? selected.label : placeholder || "Select…"}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-2 w-full max-h-64 overflow-auto rounded-lg border border-white/10 bg-[#14141c] shadow-xl shadow-black/40 backdrop-blur-xl py-1"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <li key={opt.value || "__empty"} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left text-sm transition-colors ${
                    isSelected
                      ? "bg-gradient-to-r from-cyan-500/20 to-purple-600/20 text-white"
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-cyan-300 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

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

  const projectOptions: DropdownOption[] = [
    { value: "", label: "-- General Request --" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  const budgetOptions: DropdownOption[] = [
    { value: "₹500 - ₹1000", label: "₹500 - ₹1000" },
    { value: "₹1000 - ₹5000", label: "₹1000 - ₹5000" },
    { value: "₹5000 - ₹10000", label: "₹5000 - ₹10000" },
    { value: "₹10000+", label: "₹10000+" },
  ];

  const priorityOptions: DropdownOption[] = [
    { value: "low", label: "🟢 Low" },
    { value: "normal", label: "🟡 Normal" },
    { value: "urgent", label: "🔴 Urgent" },
  ];

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
            <CustomDropdown
              value={formData.projectId}
              options={projectOptions}
              onChange={(val) => setFormData({ ...formData, projectId: val })}
            />
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
              <CustomDropdown
                value={formData.budget}
                options={budgetOptions}
                onChange={(val) => setFormData({ ...formData, budget: val })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Priority
              </label>
              <CustomDropdown
                value={formData.priority}
                options={priorityOptions}
                onChange={(val) => setFormData({ ...formData, priority: val })}
              />
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