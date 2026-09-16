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
} from "lucide-react";

type Contact = {
  id: string;
  name: string;
  email: string;
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

export default function AdminContactPanel() {
  const { data: session } = useSession();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "in-progress" | "completed">("all");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isReplying, setIsReplying] = useState(false);

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

  const handleDelete = async (contactId: string) => {
    if (!confirm("Delete this contact request?") || !session?.user.accessToken) return;
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/contact/${contactId}`,
        { headers: { Authorization: `Bearer ${session.user.accessToken}` } }
      );
      await fetchContacts();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete");
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
            onClick={() => setFilter(f)}
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
              {filteredContacts.map((contact) => {
                const config = statusConfig[contact.status] || statusConfig.pending;
                return (
                  <tr key={contact.id} className="border-b border-white/5 hover:bg-white/5 transition">
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
                          onClick={() => handleDelete(contact.id)}
                          className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

            <div className="mb-4 p-4 bg-white/5 rounded-lg">
              <div className="text-sm">
                <span className="text-gray-500">From: </span>
                <span className="text-gray-200">{selectedContact.name} ({selectedContact.email})</span>
              </div>
              <div className="text-sm mt-1">
                <span className="text-gray-500">Project: </span>
                <span className="text-gray-200">{selectedContact.projectName || "General"}</span>
              </div>
              <div className="text-sm mt-1">
                <span className="text-gray-500">Budget: </span>
                <span className="text-cyan-300">{selectedContact.budget}</span>
                <span className="text-gray-500 ml-4">Priority: </span>
                <span>{priorityEmoji[selectedContact.priority]} {selectedContact.priority}</span>
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
    </section>
  );
}