"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import {
  ArrowLeft,
  Send,
  Check,
  CheckCheck,
  Clock,
  Paperclip,
  X,
  FileText,
  Download,
  Loader2,
} from "lucide-react";
import { useSocket } from "@/app/providers/SocketProvider";

type MessageStatus = "sending" | "sent" | "delivered" | "read";
type MessageType = "text" | "image" | "document";

type Message = {
  clientId?: string;
  sender: "user" | "admin";
  type?: MessageType;
  text: string;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
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

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewingFile, setViewingFile] = useState<{ url: string; type: "image" | "pdf" } | null>(null);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File too large. Maximum 10MB allowed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    setUploadError("");

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
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = () => {
    if (!newMessage.trim() || !socket || !contact) return;

    const clientId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const optimisticMessage: Message = {
      clientId,
      sender: "admin",
      type: "text",
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
      type: "text",
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

  const handleSendFile = async () => {
    if (!selectedFile || !socket || !contact || !session?.user?.accessToken) return;

    setIsUploading(true);
    setUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const uploadRes = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${session.user.accessToken}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const { fileUrl, fileName, fileSize, mimeType, type } = uploadRes.data;

      const clientId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const isPdf = mimeType === "application/pdf";
      const messageType: MessageType = (type === "image" || isPdf) ? "image" : "document";
      const caption = newMessage.trim();

      const optimisticMessage: Message = {
        clientId,
        sender: "admin",
        type: messageType,
        text: caption,
        fileUrl,
        fileName,
        fileSize,
        mimeType,
        timestamp: new Date().toISOString(),
        status: "sending",
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      socket.emit("send-message", {
        contactId: contact.id,
        text: caption,
        clientId,
        type: messageType,
        fileUrl,
        fileName,
        fileSize,
        mimeType,
      });

      clearSelectedFile();
      setNewMessage("");

      setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.clientId === clientId && msg.status === "sending"
              ? { ...msg, status: "sent" }
              : msg
          )
        );
      }, 500);
    } catch (error: any) {
      console.error("Upload error:", error);
      setUploadError(error.response?.data?.error || "Upload failed");
    } finally {
      setIsUploading(false);
    }
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (selectedFile) {
        void handleSendFile();
      } else {
        handleSend();
      }
    }
  };

  const openFileViewer = (url: string, mimeType?: string | null, fileName?: string | null) => {
    const isPdf = mimeType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");
    setViewingFile({ url, type: isPdf ? "pdf" : "image" });
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
            const msgType = msg.type || "text";
            const isPdfMsg = msg.mimeType === "application/pdf" || msg.fileName?.toLowerCase().endsWith(".pdf");
            const isViewable = msgType === "image" && msg.fileUrl;

            return (
              <div key={msg.clientId || i} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl shadow-sm overflow-hidden ${
                    isAdmin
                      ? "bg-gradient-to-br from-cyan-500 to-purple-600 text-white rounded-br-md"
                      : "bg-white/[0.06] border border-white/[0.06] text-gray-100 rounded-bl-md"
                  }`}
                >
                  {isViewable && msg.fileUrl && (
                    <button
                      onClick={() => openFileViewer(msg.fileUrl!, msg.mimeType, msg.fileName)}
                      className="block w-full"
                    >
                      {isPdfMsg ? (
                        <div className={`flex items-center gap-3 px-4 py-4 ${isAdmin ? "bg-white/5" : "bg-white/[0.03]"}`}>
                          <div className={`p-3 rounded-lg ${isAdmin ? "bg-white/15" : "bg-white/10"}`}>
                            <FileText className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-medium truncate">{msg.fileName || "Document.pdf"}</p>
                            <p className={`text-xs ${isAdmin ? "text-white/70" : "text-gray-500"}`}>
                              PDF • {msg.fileSize ? formatFileSize(msg.fileSize) : ""}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={msg.fileUrl}
                          alt={msg.fileName || "attachment"}
                          className="max-w-full max-h-80 object-cover cursor-pointer hover:opacity-95 transition"
                        />
                      )}
                    </button>
                  )}

                  {msgType === "document" && msg.fileUrl && (
                    <a
                      href={msg.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={msg.fileName || "document"}
                      className={`flex items-center gap-3 px-4 py-3 ${
                        isAdmin ? "hover:bg-white/5" : "hover:bg-white/[0.03]"
                      } transition`}
                    >
                      <div className={`p-2.5 rounded-lg ${isAdmin ? "bg-white/15" : "bg-white/10"}`}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium truncate">{msg.fileName || "Document"}</p>
                        <p className={`text-xs ${isAdmin ? "text-white/70" : "text-gray-500"}`}>
                          {msg.fileSize ? formatFileSize(msg.fileSize) : ""}
                        </p>
                      </div>
                      <Download className="w-4 h-4 opacity-70 shrink-0" />
                    </a>
                  )}

                  {msg.text && (
                    <div className="px-4 py-2.5">
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>
                    </div>
                  )}

                  <div
                    className={`text-[11px] px-4 pb-1.5 flex items-center justify-end gap-1 ${
                      isAdmin ? "text-white/70" : "text-gray-500"
                    } ${msgType !== "text" ? "pt-1" : "mt-1"}`}
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

      {selectedFile && (
        <div className="fixed bottom-20 left-0 right-0 z-40 px-4">
          <div className="max-w-3xl mx-auto bg-[#1a1a2e] border border-cyan-500/30 rounded-2xl p-3 flex items-center gap-3 shadow-2xl">
            {filePreview ? (
              <img src={filePreview} alt="preview" className="w-14 h-14 rounded-lg object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-white/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-cyan-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedFile.name}</p>
              <p className="text-xs text-gray-400">{formatFileSize(selectedFile.size)}</p>
              {uploadError && <p className="text-xs text-red-400 mt-0.5">{uploadError}</p>}
            </div>
            <button
              onClick={clearSelectedFile}
              disabled={isUploading}
              className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#0a0a0f]/80 backdrop-blur-xl border-t border-white/[0.08]">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                onChange={handleFileSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || !!selectedFile}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-gray-400 hover:text-cyan-400 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed z-10"
                title="Attach file"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={handleTyping}
                onKeyDown={handleKeyDown}
                placeholder={selectedFile ? "Add a caption…" : "Type a message…"}
                className="w-full pl-12 pr-4 py-3 bg-white/[0.06] border border-white/10 rounded-full text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-400/60 focus:bg-white/[0.08] transition-colors"
              />
            </div>

            <button
              onClick={selectedFile ? handleSendFile : handleSend}
              disabled={
                selectedFile 
                  ? (!isConnected || isUploading)
                  : (!newMessage.trim() || !isConnected)
              }
              className="shrink-0 p-3 rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 shadow-lg shadow-purple-500/20 hover:scale-105 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {viewingFile && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setViewingFile(null)}
        >
          <button
            onClick={() => setViewingFile(null)}
            className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {viewingFile.type === "pdf" ? (
            <iframe
              src={viewingFile.url}
              title="PDF viewer"
              className="w-full h-full max-w-4xl rounded-lg bg-white"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={viewingFile.url}
              alt="fullscreen"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </main>
  );
}