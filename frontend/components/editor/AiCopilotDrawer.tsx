"use client";

import { useState, useEffect, useRef } from "react";
import {
  Bot,
  Send,
  User,
  X,
  Sparkles,
  Loader2,
  ArrowRight,
  Trash2,
  MessageSquare,
  Wrench,
  Check,
} from "lucide-react";

type ChatMessage = {
  id: string;
  sender: "user" | "copilot";
  text: string;
  timestamp: string;
  isCodeChange?: boolean;
  canApply?: boolean;
};

interface AiCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSendMessage: (instruction: string) => Promise<void>;
  onChatQuery?: (message: string) => Promise<string>;
  isBusy: boolean;
  activeFilePath?: string;
}

const quickPrompts = [
  "Add a responsive FAQ accordion section",
  "Add customer testimonials with ratings",
  "Add an inquiry contact form with validation",
  "Make the navbar sticky with blur glass effect",
  "Add a CTA banner with newsletter signup",
];

// Check if message is a simple zero-token greeting
const isSimpleGreeting = (text: string): boolean => {
  const lower = text.toLowerCase().trim();
  const greetingPattern =
    /^(hi|hii|hiii|hello|helo|hey|heyy|hola|namaste|good\s*(morning|afternoon|evening)|yo|sup|kaise ho|kya hal|kya chal)\b/i;
  return greetingPattern.test(lower) && lower.split(/\s+/).length <= 4;
};

const isEditInstruction = (text: string): boolean => {
  const lower = text.toLowerCase().trim();

  // Quick greetings or questions that should NOT edit code
  if (isSimpleGreeting(text)) {
    return false;
  }

  // Pure informational questions
  if (
    /^(what|how|where|why|can you explain|tell me|who)\b/i.test(lower) &&
    !/(add|make|change|update|create|fix|build|write|implement|style|replace|insert|delete)/i.test(
      lower
    )
  ) {
    return false;
  }

  // Edit action keywords
  const editKeywords = [
    "add",
    "create",
    "make",
    "change",
    "update",
    "fix",
    "remove",
    "delete",
    "replace",
    "style",
    "color",
    "theme",
    "button",
    "section",
    "navbar",
    "footer",
    "card",
    "font",
    "form",
    "accordion",
    "slider",
    "modal",
    "page",
    "responsive",
    "border",
    "background",
    "hero",
    "pricing",
    "testimonial",
    "gallery",
    "menu",
    "input",
    "animate",
    "animation",
    "text",
    "heading",
    "title",
    "layout",
    "component",
    "refactor",
  ];

  return editKeywords.some((word) => lower.includes(word)) || lower.length > 30;
};

// Client-side instant zero-token responses for common greetings and basic FAQs
const getInstantReply = (text: string, activeFilePath?: string): string => {
  const lower = text.toLowerCase().trim();

  if (
    /^(hi|hii|hiii|hello|helo|hey|heyy|hola|namaste|good\s*(morning|afternoon|evening)|yo|sup)\b/i.test(
      lower
    )
  ) {
    return "Hey there! 👋 I'm your Genetix AI Copilot.\n\nI can both answer your questions and directly modify your website code! For example:\n\n• Ask advice: 'How can I make the hero section more engaging?'\n• Direct edit: 'Add customer testimonials with 5-star ratings'\n• Styling: 'Make navbar sticky with dark glassmorphism'\n\nWhat would you like to explore or build?";
  }

  if (/(who are you|what can you do|kya kar sakte ho|features|help)/i.test(lower)) {
    return "I am your AI Pair Programmer for Genetix! 🤖\n\n1. 💬 Chat Mode: Ask me anything about your project or code.\n2. ⚡ Code Edits: Describe changes and I will update your code files directly.\n3. 🎨 Theming: Change colors, gradients, dark/light modes.\n4. 🚀 Apply Button: Click 'Apply to Website' on any suggestion to push it live!";
  }

  if (/(how to run|run locally|download|install|local)/i.test(lower)) {
    return "To run this project locally on your machine:\n\n1. Click 'Download ZIP' in the editor header.\n2. Extract the downloaded zip folder.\n3. Run:\n   cd frontend && npm install && npm run dev\n4. Open the shown localhost URL in your browser!";
  }

  return `Currently targeting: ${activeFilePath || "Entire project"}. Ask me anything about your website or describe a component you'd like to add!`;
};

export default function AiCopilotDrawer({
  isOpen,
  onClose,
  projectId,
  onSendMessage,
  onChatQuery,
  isBusy,
  activeFilePath,
}: AiCopilotDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"auto" | "chat" | "edit">("auto");
  const [isThinking, setIsThinking] = useState(false);
  const [appliedMsgId, setAppliedMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history
  useEffect(() => {
    if (!projectId) return;
    const key = `genetix_copilot_${projectId}`;
    const saved = window.localStorage.getItem(key);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch {
        // ignore
      }
    } else {
      const initial: ChatMessage[] = [
        {
          id: "welcome",
          sender: "copilot",
          text: "Hi! I'm your Genetix AI Copilot. You can talk to me like a chatbot to get advice, ask questions, or tell me to directly modify your website code!",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ];
      setMessages(initial);
      window.localStorage.setItem(key, JSON.stringify(initial));
    }
  }, [projectId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isBusy, isThinking]);

  const clearChat = () => {
    const key = `genetix_copilot_${projectId}`;
    const initial: ChatMessage[] = [
      {
        id: "welcome",
        sender: "copilot",
        text: "Chat cleared! How can I help you customize your website?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ];
    setMessages(initial);
    window.localStorage.setItem(key, JSON.stringify(initial));
  };

  const handleApplyFromChat = async (textToApply: string, msgId?: string) => {
    if (isBusy || isThinking) return;
    if (msgId) setAppliedMsgId(msgId);
    try {
      await onSendMessage(textToApply);
      const copilotReply: ChatMessage = {
        id: Date.now().toString(),
        sender: "copilot",
        text: "✅ Applied to your website! A new version snapshot has been saved to your timeline.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isCodeChange: true,
      };
      setMessages((prev) => {
        const next = [...prev, copilotReply];
        window.localStorage.setItem(`genetix_copilot_${projectId}`, JSON.stringify(next));
        return next;
      });
    } catch {
      // Handled by parent error toast
    } finally {
      if (msgId) setTimeout(() => setAppliedMsgId(null), 3000);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const prompt = (textToSend || input).trim();
    if (!prompt || isBusy || isThinking) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");

    // Determine action based on mode & intent:
    // 1. Direct Code Edit: mode is "edit" OR (mode is "auto" and it is an edit instruction)
    const shouldEditCode = mode === "edit" || (mode === "auto" && isEditInstruction(prompt));

    if (shouldEditCode) {
      try {
        await onSendMessage(prompt);

        const copilotReply: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: "copilot",
          text: `✅ Done! I've updated your website code for: "${prompt.slice(0, 60)}${
            prompt.length > 60 ? "..." : ""
          }". A new version snapshot has been saved to your timeline. Check the preview to see the changes!`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isCodeChange: true,
        };

        const finalMessages = [...nextMessages, copilotReply];
        setMessages(finalMessages);
        window.localStorage.setItem(`genetix_copilot_${projectId}`, JSON.stringify(finalMessages));
      } catch {
        const errorReply: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: "copilot",
          text: "Sorry, I ran into an error while applying that update. Please try rephrasing your request.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        const finalMessages = [...nextMessages, errorReply];
        setMessages(finalMessages);
        window.localStorage.setItem(`genetix_copilot_${projectId}`, JSON.stringify(finalMessages));
      }
      return;
    }

    // 2. Pure zero-token simple greeting (saves user tokens and gives instant reply)
    if (isSimpleGreeting(prompt)) {
      const replyText = getInstantReply(prompt, activeFilePath);
      const copilotReply: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "copilot",
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isCodeChange: false,
        canApply: false,
      };
      const finalMessages = [...nextMessages, copilotReply];
      setMessages(finalMessages);
      window.localStorage.setItem(`genetix_copilot_${projectId}`, JSON.stringify(finalMessages));
      return;
    }

    // 3. Real AI Chatbot Response via Gemini/Groq
    setIsThinking(true);
    try {
      let replyText = "";
      if (onChatQuery) {
        replyText = await onChatQuery(prompt);
      } else {
        replyText = getInstantReply(prompt, activeFilePath);
      }

      const copilotReply: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "copilot",
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isCodeChange: false,
        canApply: true,
      };

      const finalMessages = [...nextMessages, copilotReply];
      setMessages(finalMessages);
      window.localStorage.setItem(`genetix_copilot_${projectId}`, JSON.stringify(finalMessages));
    } catch {
      const errorReply: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "copilot",
        text: "I couldn't reach the AI server right now. You can still tell me direct code instructions or retry.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      const finalMessages = [...nextMessages, errorReply];
      setMessages(finalMessages);
      window.localStorage.setItem(`genetix_copilot_${projectId}`, JSON.stringify(finalMessages));
    } finally {
      setIsThinking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] bg-[#10101a] border-l border-white/10 shadow-2xl flex flex-col text-white backdrop-blur-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 shadow-md">
            <Bot className="w-5 h-5 text-white" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#10101a]" />
          </div>
          <div>
            <h2 className="text-sm font-bold flex items-center gap-1.5">
              <span>AI Copilot</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                2-IN-1
              </span>
            </h2>
            <p className="text-[11px] text-gray-400 truncate max-w-[210px]">
              {activeFilePath ? `Focusing on ${activeFilePath}` : "Full Project Context"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={clearChat}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-300 hover:bg-white/10 transition cursor-pointer"
            title="Clear chat history"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Close Copilot"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          return (
            <div key={msg.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
              {!isUser && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300 mt-0.5 border border-cyan-400/20">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  isUser
                    ? "bg-gradient-to-br from-cyan-500/20 to-purple-600/30 border border-cyan-400/30 text-white rounded-tr-sm"
                    : msg.isCodeChange
                    ? "bg-emerald-500/10 border border-emerald-400/30 text-emerald-100 rounded-tl-sm"
                    : "bg-white/5 border border-white/10 text-gray-200 rounded-tl-sm"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>

                {/* Apply button for AI suggestions */}
                {!isUser && msg.canApply && (
                  <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplyFromChat(msg.text, msg.id)}
                      disabled={isBusy || isThinking}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 border border-cyan-400/30 text-[11px] font-semibold text-cyan-300 hover:text-white transition cursor-pointer disabled:opacity-40"
                    >
                      {appliedMsgId === msg.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Applied!</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                          <span>⚡ Apply to Website</span>
                        </>
                      )}
                    </button>
                    <span className="text-[10px] text-gray-500">{msg.timestamp}</span>
                  </div>
                )}

                {(isUser || !msg.canApply) && (
                  <span className="block mt-1.5 text-[10px] text-gray-400 text-right">
                    {msg.timestamp}
                  </span>
                )}
              </div>

              {isUser && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300 mt-0.5 border border-purple-400/20">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {isThinking && (
          <div className="flex items-center gap-3 text-xs text-purple-300 bg-purple-500/10 border border-purple-400/20 p-3 rounded-2xl w-fit animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
            <span>Copilot AI is thinking...</span>
          </div>
        )}

        {isBusy && (
          <div className="flex items-center gap-3 text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-400/20 p-3 rounded-2xl w-fit">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
            <span>AI Copilot is modifying website code files...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="px-4 py-2 border-t border-white/10 bg-black/20">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mb-1.5 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          Suggested Actions
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {quickPrompts.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => handleSend(q)}
              disabled={isBusy || isThinking}
              className="text-[11px] px-3 py-1.5 rounded-xl bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-200 border border-white/5 hover:border-cyan-400/30 text-gray-300 shrink-0 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <span>{q}</span>
              <ArrowRight className="w-3 h-3 opacity-60" />
            </button>
          ))}
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center gap-1.5 px-4 pt-2 pb-1 text-[11px] bg-[#12121e] border-t border-white/5">
        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mr-1">
          Mode:
        </span>
        <button
          type="button"
          onClick={() => setMode("auto")}
          className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
            mode === "auto"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40"
              : "text-gray-400 hover:text-white bg-white/5 border border-transparent"
          }`}
          title="Automatically decides whether to answer as chat or edit code"
        >
          <Sparkles className="w-3 h-3" /> Auto
        </button>
        <button
          type="button"
          onClick={() => setMode("chat")}
          className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
            mode === "chat"
              ? "bg-purple-500/20 text-purple-300 border border-purple-400/40"
              : "text-gray-400 hover:text-white bg-white/5 border border-transparent"
          }`}
          title="Chat only: Ask questions or get explanations without touching code"
        >
          <MessageSquare className="w-3 h-3" /> Chat
        </button>
        <button
          type="button"
          onClick={() => setMode("edit")}
          className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
            mode === "edit"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
              : "text-gray-400 hover:text-white bg-white/5 border border-transparent"
          }`}
          title="Directly edit website files"
        >
          <Wrench className="w-3 h-3" /> Edit Code
        </button>
      </div>

      {/* Input Form */}
      <div className="p-4 bg-[#12121e]">
        <div className="flex items-center gap-2 rounded-2xl bg-black/40 border border-white/10 p-2 focus-within:border-cyan-400 transition">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            disabled={isBusy || isThinking}
            placeholder={
              mode === "chat"
                ? "Ask Copilot anything about your code or design..."
                : mode === "edit"
                ? "Describe code changes to apply to your website..."
                : "Ask a question or describe changes to apply..."
            }
            className="flex-1 bg-transparent px-2 text-xs text-white placeholder-gray-400 outline-none resize-none"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={isBusy || isThinking || !input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white disabled:opacity-40 transition cursor-pointer"
          >
            {isBusy || isThinking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-gray-500 text-center">
          Press Enter to send • Shift + Enter for new line • Zero tokens wasted on greetings
        </p>
      </div>
    </div>
  );
}
