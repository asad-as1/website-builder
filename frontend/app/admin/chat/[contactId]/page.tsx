"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { ArrowLeft, Send, Check, CheckCheck, Clock } from "lucide-react";
import { useSocket } from "@/app/providers/SocketProvider";

type MessageStatus = "sending" | "sent" | "delivered" | "read";

type Message = {
  clientId?: string;
  sender: "user" | "admin";
  text: string;
  timestamp: string;
  status: MessageStatus;
  read?: boolean;
};

type Contact = {
  id: string;
  name: string;
  email: string;
  projectName: string;
  budget: string;
  priority: string;
  status: string;
  messages: Message[];
};

// ✅ Ticks — Admin side (right)
function MessageTicks({ status }: { status: MessageStatus }) {
  const iconClass = "w-3.5 h-3.5";

  switch (status) {
    case "sending":
      return <Clock className={`${iconClass} text-white/40`} />;
    case "sent":
      return <Check className={`${iconClass} text-white/50`} />;
    case "delivered":
      return <CheckCheck className={`${iconClass} text-white/50`} />;
    case "read":
      return <CheckCheck className={`${iconClass} text-cyan-300`} />;
    default:
      return <Check className={`${iconClass} text-white/50`} />;
  }
}

export default function AdminChatRoomPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ contactId: string }>();
  const { socket, isConnected } = useSocket();

  const [contact, setContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [userTyping, setUserTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (session?.user?.role !== process.env.NEXT_PUBLIC_ADMIN_ROLE) return;
  }, [status, router, session?.user?.role]);

  useEffect(() => {
    if (!session?.user?.accessToken || !params.contactId) return;
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/contact/admin/all`, {
        headers: { Authorization: `Bearer ${session.user.accessToken}` },
      })
      .then((res) => {
        const found = (res.data.contacts || []).find((c: Contact) => c.id === params.contactId);
        if (found) {
          setContact(found);
          setMessages(found.messages || []);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [session?.user?.accessToken, params.contactId]);

  useEffect(() => {
    if (!socket || !contact) return;
    socket.emit("join-room", { contactId: contact.id });
    socket.emit("mark-read", { contactId: contact.id });
    return () => {
      socket.emit("leave-room", { contactId: contact.id });
      socket.emit("mark-read", { contactId: contact.id });
    };
  }, [socket, contact]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = ({ contactId, message }: any) => {
      if (contactId !== params.contactId) return;
      setMessages((prev) => {
        const isDuplicate = prev.some(
          (msg) => msg.clientId && message.clientId && msg.clientId === message.clientId
        );
        if (isDuplicate) return prev;
        const isSameByTimestamp = prev.some(
          (msg) =>
            msg.text === message.text &&
            msg.sender === message.sender &&
            Math.abs(new Date(msg.timestamp).getTime() - new Date(message.timestamp).getTime()) < 2000
        );
        if (isSameByTimestamp) return prev;
        return [...prev, message];
      });
      if (message.sender === "user") {
        socket.emit("mark-read", { contactId });
      }
    };

    const handleTyping = ({ contactId, isTyping: typing }: any) => {
      if (contactId !== params.contactId) return;
      setUserTyping(typing);
    };

    const handleDelivered = ({ contactId }: any) => {
      if (contactId !== params.contactId) return;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.sender === "admin" && (msg.status === "sent" || msg.status === "sending")
            ? { ...msg, status: "delivered" as MessageStatus }
            : msg
        )
      );
    };

    const handleMessagesRead = ({ contactId, readBy }: any) => {
      if (contactId !== params.contactId) return;
      setMessages((prev) =>
        prev.map((msg) => {
          if (readBy === "user" && msg.sender === "admin") {
            return { ...msg, status: "read" as MessageStatus, read: true };
          }
          if (readBy === "admin" && msg.sender === "user") {
            return { ...msg, status: "read" as MessageStatus, read: true };
          }
          return msg;
        })
      );
    };

    socket.on("new-message", handleNewMessage);
    socket.on("user-typing", handleTyping);
    socket.on("message-delivered", handleDelivered);
    socket.on("messages-read", handleMessagesRead);

    return () => {
      socket.off("new-message", handleNewMessage);
      socket.off("user-typing", handleTyping);
      socket.off("message-delivered", handleDelivered);
      socket.off("messages-read", handleMessagesRead);
    };
  }, [socket, params.contactId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim() || !socket || !contact) return;

    const clientId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const optimisticMessage: Message = {
      clientId,
      sender: "admin",
      text: newMessage.trim(),
      timestamp: new Date().toISOString(),
      status: "sending",
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    const messageText = newMessage.trim();
    setNewMessage("");

    socket.emit("send-message", {
      contactId: contact.id,
      text: messageText,
      clientId,
    });
    socket.emit("typing", { contactId: contact.id, isTyping: false });

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.clientId === clientId && msg.status === "sending"
            ? { ...msg, status: "sent" }
            : msg
        )
      );
    }, 500);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!socket || !contact) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit("typing", { contactId: contact.id, isTyping: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit("typing", { contactId: contact.id, isTyping: false });
    }, 1500);
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />
      </div>
    );
  }

  if (session?.user?.role !== process.env.NEXT_PUBLIC_ADMIN_ROLE) {
    return (
      <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-white">
        <h1 className="text-2xl font-bold">Access denied</h1>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white flex flex-col relative overflow-hidden">
      {/* ambient background glow, purely decorative */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]" />
      </div>

      <header className="fixed top-16 left-0 right-0 z-40 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/admin/chat"
            className="p-2 -ml-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center font-semibold text-sm shadow-lg shadow-purple-500/20">
              {(contact?.name || "U").charAt(0).toUpperCase()}
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0a0a0f] ${
                isConnected ? "bg-emerald-400" : "bg-gray-500"
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold leading-tight truncate">{contact?.name}</h2>
            <p className="text-xs text-gray-400 truncate">
              {isConnected ? contact?.email : "Connecting…"}
            </p>
          </div>
          {contact?.priority && (
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/5 border border-white/10 text-gray-300 shrink-0">
              {contact.priority}
            </span>
          )}
        </div>
        {contact && (contact.projectName || contact.budget) && (
          <div className="max-w-3xl mx-auto px-4 pb-2.5 flex items-center gap-4 text-xs text-gray-500">
            {contact.projectName && (
              <span className="truncate">
                <span className="text-gray-600">Project </span>
                <span className="text-gray-300">{contact.projectName}</span>
              </span>
            )}
            {contact.budget && (
              <span className="truncate">
                <span className="text-gray-600">Budget </span>
                <span className="text-cyan-300">{contact.budget}</span>
              </span>
            )}
          </div>
        )}
      </header>

      <div className="relative z-10 flex-1 overflow-y-auto pt-40 pb-32 px-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center gap-2 py-24 text-gray-500">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-1">
                <Send className="w-5 h-5 text-gray-500" />
              </div>
              <p className="text-sm">No messages yet</p>
              <p className="text-xs text-gray-600">Say hello to get the conversation started</p>
            </div>
          )}
          {messages.map((msg, i) => {
            const isAdmin = msg.sender === "admin";
            return (
              <div key={msg.clientId || i} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl shadow-sm ${
                    isAdmin
                      ? "bg-gradient-to-br from-cyan-500 to-purple-600 text-white rounded-br-md"
                      : "bg-white/[0.06] border border-white/[0.06] text-gray-100 rounded-bl-md"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>
                  <div
                    className={`text-[11px] mt-1 flex items-center justify-end gap-1 ${
                      isAdmin ? "text-white/70" : "text-gray-500"
                    }`}
                  >
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {isAdmin && <MessageTicks status={msg.status || "sent"} />}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {userTyping && (
        <div className="fixed bottom-20 left-0 right-0 px-4 pointer-events-none z-20">
          <div className="max-w-3xl mx-auto">
            <div className="inline-flex px-4 py-3 rounded-2xl rounded-bl-md bg-white/[0.06] border border-white/[0.06] items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#0a0a0f]/80 backdrop-blur-xl border-t border-white/[0.08]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleTyping}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Type a message…"
            className="flex-1 px-4 py-3 bg-white/[0.06] border border-white/10 rounded-full text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-400/60 focus:bg-white/[0.08] transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || !isConnected}
            className="shrink-0 p-3 rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 shadow-lg shadow-purple-500/20 hover:scale-105 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </main>
  );
}