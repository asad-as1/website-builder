"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { ArrowLeft, Clock, CheckCircle, AlertCircle, MessageSquare, Calendar } from "lucide-react";

type Contact = {
  id: string;
  projectName: string;
  changes: string;
  budget: string;
  priority: string;
  status: string;
  adminReply: string;
  repliedAt: string | null;
  createdAt: string;
};

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", icon: Clock },
  "in-progress": { label: "In Progress", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", icon: AlertCircle },
  completed: { label: "Completed", color: "text-green-400 bg-green-500/10 border-green-500/20", icon: CheckCircle },
};

const priorityEmoji: Record<string, string> = {
  low: "🟢",
  normal: "🟡",
  urgent: "🔴",
};

export default function ContactHistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session?.user?.accessToken) return;
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/contact/history`, {
        headers: { Authorization: `Bearer ${session.user.accessToken}` },
      })
      .then((res) => setContacts(res.data.contacts || []))
      .catch((err) => setError(err.response?.data?.error || "Failed to load history"))
      .finally(() => setIsLoading(false));
  }, [session?.user?.accessToken]);

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-white">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white p-4 pt-24">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Contact
          </Link>
          <h1 className="text-3xl font-bold gradient-text">My Requests</h1>
          <p className="text-gray-400 mt-2">
            Track your custom change requests and admin replies
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {contacts.length === 0 ? (
          <div className="glass p-12 rounded-2xl text-center">
            <MessageSquare className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No requests yet</h3>
            <p className="text-gray-400 text-sm mb-6">
              You haven't submitted any custom change requests.
            </p>
            <Link
              href="/contact"
              className="inline-block px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg font-semibold hover:scale-105 transition"
            >
              Submit a Request
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {contacts.map((contact) => {
              const config = statusConfig[contact.status] || statusConfig.pending;
              const StatusIcon = config.icon;
              return (
                <div
                  key={contact.id}
                  className="glass p-6 rounded-2xl border border-white/5 hover:border-white/10 transition"
                >
                  {/* Top Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${config.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {config.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {priorityEmoji[contact.priority]} {contact.priority}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(contact.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  {/* Project + Budget */}
                  <div className="flex flex-wrap gap-4 mb-4 text-sm">
                    {contact.projectName && (
                      <div>
                        <span className="text-gray-500">Project: </span>
                        <span className="text-gray-200">{contact.projectName}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Budget: </span>
                      <span className="text-cyan-300">{contact.budget}</span>
                    </div>
                  </div>

                  {/* Changes */}
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">Your Request:</p>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">
                      {contact.changes}
                    </p>
                  </div>

                  {/* Admin Reply */}
                  {contact.adminReply && (
                    <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="w-4 h-4 text-cyan-400" />
                        <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                          Admin Reply
                        </p>
                        {contact.repliedAt && (
                          <span className="text-xs text-gray-500">
                            {new Date(contact.repliedAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-200 whitespace-pre-wrap">
                        {contact.adminReply}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}