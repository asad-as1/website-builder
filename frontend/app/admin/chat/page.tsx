"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import {
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Search,
  Inbox,
  MailOpen,
} from "lucide-react";
import Spinner from "@/components/shared/Spinner";
import { useSocket } from "@/app/providers/SocketProvider";

type Contact = {
  id: string;
  name: string;
  email: string;
  profilePic?: string | null;
  projectName: string;
  lastMessage: string;
  lastMessageAt: string;
  status: string;
  isUserDeleted?: boolean;
  unreadByAdmin: number;
  createdAt: string;
};

const statusConfig: Record<
  string,
  { label: string; color: string; icon: any }
> = {
  pending: {
    label: "Pending",
    color: "text-yellow-400 bg-yellow-500/10",
    icon: Clock,
  },
  "in-progress": {
    label: "In Progress",
    color: "text-cyan-400 bg-cyan-500/10",
    icon: AlertCircle,
  },
  completed: {
    label: "Completed",
    color: "text-green-400 bg-green-500/10",
    icon: CheckCircle,
  },
};

type FilterType = "all" | "unread" | "read";

export default function AdminChatListPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { socket } = useSocket();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (session?.user?.role !== "admin") return;
  }, [status, router, session?.user?.role]);

  useEffect(() => {
    if (!session?.user?.accessToken) return;
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/contact/admin/all`, {
        headers: { Authorization: `Bearer ${session.user.accessToken}` },
      })
      .then((res) => setContacts(res.data.contacts || []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [session?.user?.accessToken]);

  // ✅ Real-time socket listeners
  useEffect(() => {
    if (!socket) return;

    // Moves the touched contact to the top of the list (most recent activity first).
    // If the contact isn't in local state yet (brand new conversation), refetch quietly.
    const upsertAndBubbleUp = (
      contactId: string,
      updater: (c: Contact) => Contact,
    ) => {
      setContacts((prev) => {
        const idx = prev.findIndex((c) => c.id === contactId);
        if (idx === -1) {
          if (session?.user?.accessToken) {
            axios
              .get(`${process.env.NEXT_PUBLIC_API_URL}/contact/admin/all`, {
                headers: {
                  Authorization: `Bearer ${session.user.accessToken}`,
                },
              })
              .then((res) => setContacts(res.data.contacts || []))
              .catch(() => {});
          }
          return prev;
        }
        const updated = updater(prev[idx]);
        const next = [...prev];
        next.splice(idx, 1);
        next.unshift(updated);
        return next;
      });
    };

    // Fires only for admins who currently have the contact's room joined
    // (i.e. the chat detail page open in some tab). Backend emits:
    // { contactId, message: { sender, text, timestamp, ... } }
    const handleNewMessage = ({ contactId, message }: any) => {
      if (!message || message.sender === "admin") return; // admin's own message, already reflected
      upsertAndBubbleUp(contactId, (c) => ({
        ...c,
        lastMessage: message.text ?? c.lastMessage,
        lastMessageAt: message.timestamp ?? c.lastMessageAt,
        unreadByAdmin: (c.unreadByAdmin || 0) + 1,
      }));
    };

    const handleMessagesRead = ({ contactId, readBy }: any) => {
      if (readBy === "admin") {
        setContacts((prev) =>
          prev.map((c) =>
            c.id === contactId ? { ...c, unreadByAdmin: 0 } : c,
          ),
        );
      }
    };

    // This is the event that actually reaches the list page for every new
    // user message (broadcast to all sockets). Backend emits:
    // { contactId, userName, text }  — NOT nested under `message`, and no timestamp.
    // Previously this only bumped unreadByAdmin, so the badge updated live but
    // the preview text stayed stale until a manual refresh. Fixed below.
    const handleAdminNotification = ({ contactId, text }: any) => {
      upsertAndBubbleUp(contactId, (c) => ({
        ...c,
        lastMessage: text ?? c.lastMessage,
        lastMessageAt: new Date().toISOString(),
        unreadByAdmin: (c.unreadByAdmin || 0) + 1,
      }));
    };

    socket.on("new-message", handleNewMessage);
    socket.on("messages-read", handleMessagesRead);
    socket.on("admin-notification", handleAdminNotification);

    return () => {
      socket.off("new-message", handleNewMessage);
      socket.off("messages-read", handleMessagesRead);
      socket.off("admin-notification", handleAdminNotification);
    };
  }, [socket, session?.user?.accessToken]);

  const filteredContacts = useMemo(() => {
    let list = [...contacts];

    if (filter === "unread")
      list = list.filter((c) => (c.unreadByAdmin || 0) > 0);
    if (filter === "read")
      list = list.filter((c) => (c.unreadByAdmin || 0) === 0);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) =>
        [c.name, c.email, c.projectName, c.lastMessage]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(q)),
      );
    }

    return list.sort(
      (a, b) =>
        new Date(b.lastMessageAt || b.createdAt).getTime() -
        new Date(a.lastMessageAt || a.createdAt).getTime(),
    );
  }, [contacts, search, filter]);

  if (status === "loading" || isLoading) {
    return <Spinner fullScreen text="Loading chats..." />;
  }

  if (session?.user?.role !== "admin") {
    return (
      <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-white">
        <h1 className="text-2xl font-bold">Access denied</h1>
      </main>
    );
  }

  const totalUnread = contacts.reduce(
    (sum, c) => sum + (c.unreadByAdmin || 0),
    0,
  );

  const filterTabs: { key: FilterType; label: string; icon: any }[] = [
    { key: "all", label: "All", icon: Inbox },
    { key: "unread", label: "Unread", icon: MessageSquare },
    { key: "read", label: "Read", icon: MailOpen },
  ];

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white p-4 pt-24">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold gradient-text">Admin Chats</h1>
              <p className="text-gray-400 mt-2">
                {contacts.length} conversations
                {totalUnread > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-red-500 rounded-full text-xs">
                    {totalUnread} unread
                  </span>
                )}
              </p>
            </div>
            <Link
              href="/admin"
              className="px-4 py-2 rounded-lg border border-white/10 text-sm text-gray-300 hover:bg-white/5 transition"
            >
              ← Back to Admin
            </Link>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, project or message..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50 transition"
          />
        </div>

        {/* Read/Unread filter tabs */}
        <div className="flex items-center gap-2 mb-6">
          {filterTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = filter === tab.key;
            const count =
              tab.key === "all"
                ? contacts.length
                : tab.key === "unread"
                  ? contacts.filter((c) => (c.unreadByAdmin || 0) > 0).length
                  : contacts.filter((c) => (c.unreadByAdmin || 0) === 0).length;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition ${
                  isActive
                    ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-400"
                    : "border-white/10 text-gray-400 hover:bg-white/5"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                <span className="text-xs text-gray-500">({count})</span>
              </button>
            );
          })}
        </div>

        {filteredContacts.length === 0 ? (
          <div className="glass p-12 rounded-2xl text-center">
            <MessageSquare className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {contacts.length === 0
                ? "No conversations yet"
                : "No matching conversations"}
            </h3>
            <p className="text-gray-400 text-sm">
              {contacts.length === 0
                ? "Users requests will show here."
                : "Try a different search or filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredContacts.map((contact) => {
              const config =
                statusConfig[contact.status] || statusConfig.pending;
              const StatusIcon = config.icon;
              const hasUnread = (contact.unreadByAdmin || 0) > 0;
              return (
                <Link
                  key={contact.id}
                  href={`/admin/chat/${contact.id}`}
                  className={`glass p-5 rounded-xl border transition flex items-center gap-4 ${
                    hasUnread
                      ? "border-cyan-500/30 bg-cyan-500/[0.03]"
                      : "border-white/5 hover:border-cyan-500/30 hover:bg-white/[0.07]"
                  }`}
                >
                  {contact.profilePic ? (
                    <img
                      src={contact.profilePic}
                      alt={contact.name || "User"}
                      className="w-16 h-16 rounded-full object-cover flex-shrink-0 border border-white/10"
                      onError={(e) => {
                        // Fallback to first letter
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        const parent = target.parentElement;
                        if (parent) {
                          const fallback = document.createElement("div");
                          fallback.className =
                            "w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center font-bold text-lg";
                          fallback.textContent = (contact.name || "U")
                            .charAt(0)
                            .toUpperCase();
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center font-bold text-lg flex-shrink-0">
                      {(contact.name || "U").charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3
                        className={`truncate ${hasUnread ? "font-bold text-white" : "font-semibold"}`}
                      >
                        {contact.name}
                      </h3>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {contact.lastMessageAt
                          ? new Date(contact.lastMessageAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                              },
                            )
                          : ""}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1 truncate">
                      {contact.projectName || "General Request"}
                    </p>
                    <p
                      className={`text-sm truncate ${hasUnread ? "text-gray-200" : "text-gray-400"}`}
                    >
                      {contact.lastMessage || "No messages yet"}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${config.color}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {config.label}
                      </span>
                      {contact.isUserDeleted && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
                          Account Deleted
                        </span>
                      )}
                      {hasUnread && (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-cyan-500 text-xs font-bold">
                          {contact.unreadByAdmin}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
