"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

type GeneratedFile = {
  path: string;
  content: string;
};

type Project = {
  id: string;
  name: string;
  prompt: string;
  status: string;
  createdAt: string;
};

const projectSlug = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project";

type RazorpayCheckout = {
  open: () => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [usage, setUsage] = useState({ used: 0, limit: 100 });
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [generationStep, setGenerationStep] = useState("");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (!session?.user?.accessToken || !apiUrl) return;

    fetch(`${apiUrl}/ai/projects`, {
      headers: { Authorization: `Bearer ${session.user.accessToken}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load projects");
        return response.json();
      })
      .then((data) => setProjects(data.projects || []))
      .catch(() => setError("Projects could not be loaded."));

    fetch(`${apiUrl}/auth/me`, {
      headers: {       Authorization: "Bearer " + session.user.accessToken, },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Usage could not be loaded");
        return response.json();
      })
      .then((data) => {
        const user = data.user;
        const limits: Record<string, number> = { free: 50, starter: 500, growth: 1000, pro: 1500, business: 5000, scale: 15000 };
        setCurrentPlan(user.plan || "free");
        const limit = limits[user.plan] || limits.free;
        setUsage({ used: user.apiUsage || 0, limit });
      })
      .catch(() => setCurrentPlan(session.user?.plan || "free"));
  }, [apiUrl, session?.user?.accessToken]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  // ✅ Plan fix: fallback "free" if not available
  const userPlan = currentPlan || session.user?.plan || "free";

  const handleGenerate = async () => {
    if (!apiUrl || !session.user.accessToken || prompt.trim().length < 5) {
      setError("Please enter at least 5 characters describing your website.");
      return;
    }

    setIsGenerating(true);
    setError("");
    setMessage("");
    setFiles([]);
    const progressSteps = [
      "Analyzing your website brief...",
      "Writing app/page.tsx...",
      "Building components and styles...",
      "Checking generated files...",
    ];
    let stepIndex = 0;
    setGenerationStep(progressSteps[stepIndex]);
    const progressTimer = window.setInterval(() => {
      stepIndex = Math.min(stepIndex + 1, progressSteps.length - 1);
      setGenerationStep(progressSteps[stepIndex]);
    }, 1400);

    try {
      const response = await fetch(`${apiUrl}/ai/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.user.accessToken}`,
        },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generation failed");
      setFiles(data.files || []);
      setUsage((current) => ({ ...current, used: current.used + 1 }));
      setMessage(`Generated ${data.files?.length || 0} files with ${data.provider}.`);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Generation failed.");
    } finally {
      window.clearInterval(progressTimer);
      setGenerationStep("");
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!apiUrl || !session.user.accessToken || files.length === 0) return;
    setIsSaving(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/ai/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.user.accessToken}`,
        },
        body: JSON.stringify({ name: prompt.slice(0, 50), prompt, files }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save project");
      setProjects((current) => [data.project, ...current]);
      setMessage("Project saved successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save project.");
    } finally {
      setIsSaving(false);
    }
  };

  const subscribeToPro = async () => {
    if (!apiUrl || !session.user.accessToken) return;
    setIsSubscribing(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/billing/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.user.accessToken}`,
        },
        body: JSON.stringify({ plan: "pro" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Subscription is not configured");

      // If backend returned a test-mode response, show a message instead of opening checkout
      if (data?.testMode) {
        setMessage(data.message || "Subscription is not configured on the backend (test mode). Proceed manually.");
        return;
      }

      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Payment checkout could not load"));
          document.body.appendChild(script);
        });
      }
      const RazorpayConstructor = window.Razorpay;
      if (!RazorpayConstructor) throw new Error("Payment checkout is unavailable");
      const checkout = new RazorpayConstructor({
        key: data.keyId,
        amount: data.order.amount,
        currency: data.order.currency,
        order_id: data.order.id,
        name: "Genetix",
        description: "Genetix Pro subscription",
        method: {
          upi: true,
        },
        config: {
          display: {
            blocks: {
              upi: {
                name: "Pay via UPI",
                instruments: [{ method: "upi" }],
              },
            },
            sequence: ["block.upi"],
            preferences: {
              show_default_blocks: false,
            },
          },
        },
        handler: async (payment: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const verify = await fetch(`${apiUrl}/billing/verify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.user.accessToken}`,
            },
            body: JSON.stringify({
              orderId: payment.razorpay_order_id,
              paymentId: payment.razorpay_payment_id,
              signature: payment.razorpay_signature,
            }),
          });
          if (!verify.ok) throw new Error("Payment verification failed");
          setMessage("Pro subscription activated.");
        },
      });
      checkout.open();
    } catch (subscriptionError) {
      setError(subscriptionError instanceof Error ? subscriptionError.message : "Subscription failed");
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] to-[#1a1a2e] text-white p-8 pt-20">
      <div className="max-w-6xl mx-auto">
        {/* Header - Without Logout Button */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold gradient-text">
              Welcome back, {session.user?.name || "User"}! 👋
            </h1>
            <p className="text-gray-400 mt-1">
              Build websites with AI in minutes
            </p>
          </div>
          {/* Plan Badge - Without Emoji */}
          {currentPlan === null ? (
            <span className="px-3 py-1 text-sm text-gray-500">Loading plan...</span>
          ) : userPlan === "free" ? (
            <Link href="/subscription" className="px-3 py-1 text-sm border border-white/10 text-gray-400 rounded-full">
              Upgrade to Pro
            </Link>
          ) : (
            <span className="px-3 py-1 text-sm border border-amber-500/30 text-amber-400 rounded-full">
              {userPlan.toUpperCase()} plan
            </span>
          )}
        </div>

        {/* AI Prompt Section */}
        <div className="glass p-6 rounded-2xl mb-8">
          <h2 className="text-xl font-semibold mb-4">🚀 Create a Website</h2>
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder='e.g., "A portfolio for a photographer"'
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleGenerate();
              }}
              className="flex-1 bg-black/20 rounded-lg p-3 outline-none text-sm"
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg font-semibold hover:scale-105 transition whitespace-nowrap disabled:opacity-60"
            >
              {isGenerating ? "Generating..." : "Generate"}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          {message && <p className="mt-3 text-sm text-emerald-400">{message}</p>}
          {isGenerating && <p className="mt-3 text-sm text-cyan-300">{generationStep}</p>}
          <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
            <span>AI requests remaining today</span>
            <span className="font-semibold text-white">{Math.max(usage.limit - usage.used, 0)} / {usage.limit}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500" style={{ width: `${Math.min((usage.used / usage.limit) * 100, 100)}%` }} />
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="text-xs text-gray-400">Templates:</span>
            <button className="px-3 py-1 text-xs bg-white/5 rounded-full hover:bg-white/10 transition">
              Portfolio
            </button>
            <button className="px-3 py-1 text-xs bg-white/5 rounded-full hover:bg-white/10 transition">
              Restaurant
            </button>
            <button className="px-3 py-1 text-xs bg-white/5 rounded-full hover:bg-white/10 transition">
              Agency
            </button>
            <button className="px-3 py-1 text-xs bg-white/5 rounded-full hover:bg-white/10 transition">
              Blog
            </button>
          </div>

          {files.length > 0 && (
            <div className="glass p-6 rounded-2xl mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Generated Files</h2>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save Project"}
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {files.map((file) => (
                  <details key={file.path} className="rounded-lg bg-black/20 p-3">
                    <summary className="cursor-pointer text-cyan-300">{file.path}</summary>
                    <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-gray-300">
                      {file.content}
                    </pre>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Projects Grid */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">📁 Your Projects</h2>
            <span className="text-sm text-gray-400">{projects.length} projects</span>
          </div>
          {projects.length === 0 ? (
            <div className="glass p-8 rounded-2xl text-center border border-dashed border-white/10">
              <p className="text-gray-400">No projects yet.</p>
              <p className="text-gray-500 text-sm mt-1">Generate your first website using the prompt above!</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {projects.map((project) => (
                <div key={project.id} className="glass p-5 rounded-2xl">
                  <Link href={`/project/${projectSlug(project.name)}`} className="font-semibold text-cyan-300 hover:underline">
                    {project.name}
                  </Link>
                  <p className="mt-2 text-sm text-gray-400 line-clamp-2">{project.prompt}</p>
                  <p className="mt-4 text-xs text-gray-500">{project.status}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
