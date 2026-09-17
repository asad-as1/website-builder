"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import {
  Send,
  CheckCircle,
  AlertCircle,
  History,
  ChevronDown,
  Check,
  Paperclip,
  X,
  FileText,
  Loader2,
} from "lucide-react";

type Project = { id: string; name: string };

type DropdownOption = {
  value: string;
  label: string;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Reusable custom dropdown
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

  // ✅ Attachment state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // ✅ File select
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setFileError("File too large. Maximum 10MB allowed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    setFileError("");

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setFileError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.accessToken) return;

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      let attachment = null;

      // ✅ Step 1: Upload file if selected
      if (selectedFile) {
        const formDataFile = new FormData();
        formDataFile.append("file", selectedFile);

        const uploadRes = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/upload`,
          formDataFile,
          {
            headers: {
              Authorization: `Bearer ${session.user.accessToken}`,
              "Content-Type": "multipart/form-data",
            },
          }
        );

        attachment = {
          type: uploadRes.data.type,
          url: uploadRes.data.fileUrl,
          fileName: uploadRes.data.fileName,
          fileSize: uploadRes.data.fileSize,
          mimeType: uploadRes.data.mimeType,
        };
      }

      // ✅ Step 2: Submit contact with attachment
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/contact`,
        { ...formData, attachment },
        { headers: { Authorization: `Bearer ${session.user.accessToken}` } }
      );

      setSuccess(response.data.message);
      setFormData({
        projectId: "",
        changes: "",
        budget: "₹500 - ₹1000",
        priority: "normal",
      });
      clearSelectedFile();
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

          {/* ✅ Attachment */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Attachment (optional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
              onChange={handleFileSelect}
            />

            {!selectedFile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 border-dashed rounded-lg text-gray-400 hover:bg-white/[0.07] hover:border-cyan-400/40 hover:text-gray-300 transition flex items-center justify-center gap-2"
              >
                <Paperclip className="w-4 h-4" />
                <span className="text-sm">Attach a file (image, PDF, doc — max 10MB)</span>
              </button>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-white/[0.05] border border-cyan-500/30 rounded-lg">
                {filePreview ? (
                  <img
                    src={filePreview}
                    alt="preview"
                    className="w-14 h-14 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-white/10 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-cyan-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-gray-400">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearSelectedFile}
                  className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {fileError && (
              <p className="text-xs text-red-400 mt-2">{fileError}</p>
            )}
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
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
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