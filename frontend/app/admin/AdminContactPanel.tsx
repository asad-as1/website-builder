"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import axios from "axios";
import {
  MessageSquare,
  Send,
  Trash2,
  RefreshCw,
  X,
  AlertTriangle,
} from "lucide-react";

type Contact = {
  id: string;
  name: string;
  email: string;
  profilePic?: string | null; // ✅ added
  projectName: string;
  changes: string;
  budget: string;
  priority: string;
  status: string;
  adminReply: string;
  repliedAt: string | null;
  createdAt: string;
};

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  "in-progress": { label: "In Progress", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  completed: { label: "Completed", color: "text-green-400 bg-green-500/10 border-green-500/20" },
};

const priorityEmoji: Record<string, string> = {
  low: "🟢",
  normal: "🟡",
  urgent: "🔴",
};

// ✅ fallback avatar helper
const getAvatar = (url?: string | null) =>
  url && url.trim().length > 0
    ? url
    : "https://ui-avatars.com/api/?background=0a0a0f&color=22d3ee&bold=true&name=U";

type Props = {
  onImageClick?: (url: string) => void; // ✅ optional: parent modal use kare
};

export default function AdminContactPanel({ onImageClick }: Props) {
  const { data: session } = useSession();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "in-progress" | "completed">("all");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const REQUESTS_PER_PAGE = 8;

  // ✅ local image preview (agar parent modal na de)
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const openImage = (url: string) => {
    if (onImageClick) onImageClick(url);
    else setPreviewImage(url);
  };

  // ✅ Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchContacts = async () => {
    if (!session?.user.accessToken) return;
    setIsLoading(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/contact/admin/all`,
        { headers: { Authorization: `Bearer ${session.user.accessToken}` } }
      );
      setContacts(res.data.contacts || []);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load contacts");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.accessToken]);

  const handleReply = async () => {
    if (!selectedContact || !replyText.trim() || !session?.user.accessToken) return;
    setIsReplying(true);
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/contact/${selectedContact.id}/reply`,
        { reply: replyText },
        { headers: { Authorization: `Bearer ${session.user.accessToken}` } }
      );
      setReplyText("");
      setSelectedContact(null);
      await fetchContacts();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to send reply");
    } finally {
      setIsReplying(false);
    }
  };

  const handleStatusChange = async (contactId: string, newStatus: string) => {
    if (!session?.user.accessToken) return;
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/contact/${contactId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${session.user.accessToken}` } }
      );
      await fetchContacts();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update status");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !session?.user.accessToken) return;
    setIsDeleting(true);
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/contact/${deleteTarget.id}`,
        { headers: { Authorization: `Bearer ${session.user.accessToken}` } }
      );
      setDeleteTarget(null);
      await fetchContacts();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredContacts = contacts.filter((c) => filter === "all" || c.status === filter);
  const counts = {
    all: contacts.length,
    pending: contacts.filter((c) => c.status === "pending").length,
    "in-progress": contacts.filter((c) => c.status === "in-progress").length,
    completed: contacts.filter((c) => c.status === "completed").length,
  };

  return (
    <section className="glass p-6 rounded-2xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-cyan-400" />
            Custom Change Requests
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {counts.pending} pending · {counts["in-progress"]} in progress
          </p>
        </div>
        <button
          onClick={fetchContacts}
          className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(["all", "pending", "in-progress", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === f
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
            }`}
          >
            {f === "all" ? "All" : f === "in-progress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="ml-2 text-xs opacity-70">({counts[f]})</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No requests found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs uppercase text-gray-500 border-b border-white/10">
                <th className="py-3 px-2">Sr. No.</th>
                <th className="py-3 px-2">Pic</th>
                <th className="py-3 px-2">User</th>
                <th className="py-3 px-2">Project</th>
                <th className="py-3 px-2">Budget</th>
                <th className="py-3 px-2">Priority</th>
                <th className="py-3 px-2">Status</th>
                <th className="py-3 px-2">Date</th>
                <th className="py-3 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const totalPages = Math.ceil(filteredContacts.length / REQUESTS_PER_PAGE) || 1;
                const paginatedContacts = filteredContacts.slice(
                  (currentPage - 1) * REQUESTS_PER_PAGE,
                  currentPage * REQUESTS_PER_PAGE
                );
                return paginatedContacts.map((contact, index) => {
                  const serialNumber = (currentPage - 1) * REQUESTS_PER_PAGE + index + 1;
                  const config = statusConfig[contact.status] || statusConfig.pending;
                  const avatar = getAvatar(contact.profilePic);
                  return (
                    <tr key={contact.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="py-3 px-2 text-sm text-gray-500">{serialNumber}</td>
                    <td className="py-3 px-2">
                      <img
                        src={avatar}
                        alt={contact.name}
                        onClick={() => openImage(avatar)}
                        className="w-14 h-14 rounded-full object-cover cursor-pointer border border-white/20 hover:scale-105 transition"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <div className="text-sm font-medium">{contact.name}</div>
                      <div className="text-xs text-gray-500">{contact.email}</div>
                    </td>
                    <td className="py-3 px-2 text-sm text-gray-300">
                      {contact.projectName || "—"}
                    </td>
                    <td className="py-3 px-2 text-sm text-cyan-300">{contact.budget}</td>
                    <td className="py-3 px-2 text-sm">
                      {priorityEmoji[contact.priority]} {contact.priority}
                    </td>
                    <td className="py-3 px-2">
                      <select
                        value={contact.status}
                        onChange={(e) => handleStatusChange(contact.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded border appearance-none cursor-pointer ${config.color}`}
                      >
                        <option value="pending" className="bg-[#1a1a2e] text-white">Pending</option>
                        <option value="in-progress" className="bg-[#1a1a2e] text-white">In Progress</option>
                        <option value="completed" className="bg-[#1a1a2e] text-white">Completed</option>
                      </select>
                    </td>
                    <td className="py-3 px-2 text-xs text-gray-500">
                      {new Date(contact.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => { setSelectedContact(contact); setReplyText(contact.adminReply || ""); }}
                          className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition"
                          title="View / Reply"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(contact)}
                          className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
          </table>

          {/* Pagination Controls */}
          {(() => {
            const totalPages = Math.ceil(filteredContacts.length / REQUESTS_PER_PAGE) || 1;
            if (totalPages <= 1) return null;
            return (
              <div className="mt-4 flex items-center justify-between text-xs text-gray-400 px-2 pt-2 border-t border-white/10">
                <span>
                  Showing {(currentPage - 1) * REQUESTS_PER_PAGE + 1} -{" "}
                  {Math.min(currentPage * REQUESTS_PER_PAGE, filteredContacts.length)} of {filteredContacts.length} requests
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="font-semibold text-white px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Reply Modal */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass p-6 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Request Details</h3>
              <button
                onClick={() => setSelectedContact(null)}
                className="p-2 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ✅ Profile pic + sender info */}
            <div className="mb-4 p-4 bg-white/5 rounded-lg flex items-start gap-3">
              <img
                src={getAvatar(selectedContact.profilePic)}
                alt={selectedContact.name}
                onClick={() => openImage(getAvatar(selectedContact.profilePic))}
                className="w-12 h-12 rounded-full object-cover cursor-pointer border border-white/20 hover:scale-105 transition"
              />
              <div className="text-sm">
                <div>
                  <span className="text-gray-500">From: </span>
                  <span className="text-gray-200">
                    {selectedContact.name} ({selectedContact.email})
                  </span>
                </div>
                <div className="mt-1">
                  <span className="text-gray-500">Project: </span>
                  <span className="text-gray-200">
                    {selectedContact.projectName || "General"}
                  </span>
                </div>
                <div className="mt-1">
                  <span className="text-gray-500">Budget: </span>
                  <span className="text-cyan-300">{selectedContact.budget}</span>
                  <span className="text-gray-500 ml-4">Priority: </span>
                  <span>
                    {priorityEmoji[selectedContact.priority]} {selectedContact.priority}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">User's Request</p>
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedContact.changes}</p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Your Reply</p>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={5}
                placeholder="Write your reply to the user..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 resize-none"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setSelectedContact(null)}
                  className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReply}
                  disabled={isReplying || replyText.trim().length < 5}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 font-semibold hover:scale-105 transition flex items-center gap-2 disabled:opacity-60"
                >
                  {isReplying ? (
                    "Sending..."
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Send Reply
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !isDeleting && setDeleteTarget(null)}
          />
          <div className="relative glass p-8 rounded-2xl w-full max-w-md mx-4 border border-white/10">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>

              <h3 className="text-xl font-semibold text-white">Delete this request?</h3>
              <p className="text-gray-400 mt-2 text-sm">
                <span className="text-white font-medium">{deleteTarget.name}</span>'s request
                {deleteTarget.projectName && ` for "${deleteTarget.projectName}"`} will be
                permanently deleted. This action cannot be undone.
              </p>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 border border-white/10 rounded-lg text-gray-300 hover:bg-white/5 transition disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-400/20 border-t-red-400" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Local image preview modal (fallback if parent didn't pass onImageClick) */}
      {!onImageClick && previewImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
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
    </section>
  );
}