"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type RazorpayCheckout = { open: () => void };
type Plan = {
  id: string;
  name: string;
  price: number;
  requests: number;
  description: string;
  benefits: string[];
  featured?: boolean;
};

const plans: Plan[] = [
  { id: "free", name: "Free", price: 0, requests: 50, description: "Try Genetix for personal experiments.", benefits: ["50 AI requests per day", "3 live previews per day", "Project editor", "ZIP export"] },
  { id: "starter", name: "Starter", price: 500, requests: 500, description: "For small personal projects.", benefits: ["500 AI requests per day", "25 live previews per day", "Version history", "AI file edits"] },
  { id: "growth", name: "Growth", price: 1000, requests: 1000, description: "For regular website building.", benefits: ["1,000 AI requests per day", "75 live previews per day", "Priority generation", "Unlimited saved projects"], featured: true },
  { id: "pro", name: "Pro", price: 1500, requests: 1500, description: "For serious individual creators.", benefits: ["1,500 AI requests per day", "150 live previews per day", "Faster AI fallback", "Advanced version history"] },
  { id: "business", name: "Business", price: 2500, requests: 5000, description: "For freelancers and small teams.", benefits: ["5,000 AI requests per day", "300 live previews per day", "Team-ready projects", "Priority support"] },
  { id: "scale", name: "Scale", price: 5000, requests: 15000, description: "For high-volume generation.", benefits: ["15,000 AI requests per day", "1,000 live previews per day", "Highest priority", "Large project workflows"] },
];

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

export default function SubscriptionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const [error, setError] = useState("");
  const [loadingPlan, setLoadingPlan] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [router, status]);

  const buyPlan = async (selectedPlan: Plan) => {
    if (selectedPlan.id === "free") return;
    if (!apiUrl || !session?.user.accessToken) return;
    setLoadingPlan(selectedPlan.id);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/billing/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.user.accessToken },
        body: JSON.stringify({ plan: selectedPlan.id }),
      });
      const data = await response.json();
      if (!response.ok || data.testMode) throw new Error(data.message || data.error || "Razorpay is not configured");
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Razorpay checkout could not load"));
          document.body.appendChild(script);
        });
      }
      const Checkout = window.Razorpay;
      if (!Checkout) throw new Error("Razorpay checkout is unavailable");
      new Checkout({
        key: data.keyId,
        amount: data.order.amount,
        currency: data.order.currency,
        order_id: data.order.id,
        name: "Genetix",
        description: `Genetix ${selectedPlan.name} plan - ${selectedPlan.requests} AI requests`,
        method: { upi: true },
        config: {
          display: {
            blocks: { upi: { name: "Pay via UPI", instruments: [{ method: "upi" }] } },
            sequence: ["block.upi"],
            preferences: { show_default_blocks: false },
          },
        },
        handler: async (payment: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const verify = await fetch(`${apiUrl}/billing/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.user.accessToken },
            body: JSON.stringify({ orderId: payment.razorpay_order_id, paymentId: payment.razorpay_payment_id, signature: payment.razorpay_signature }),
          });
          if (!verify.ok) throw new Error("Payment verification failed");
          router.push("/dashboard");
        },
      }).open();
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Payment could not start");
    } finally {
      setLoadingPlan("");
    }
  };

  if (status === "loading" || !session) return null;

  return (
    <main className="min-h-screen bg-[#0a0a0f] px-6 pb-16 pt-28 text-white">
      <div className="mx-auto max-w-5xl">
        <button onClick={() => router.push("/dashboard")} className="mb-8 text-sm text-cyan-300">← Back to dashboard</button>
        <div className="mb-10 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Genetix plans</p>
          <h1 className="mt-3 text-4xl font-bold">Build more with AI</h1>
          <p className="mt-3 text-gray-400">Choose a plan and pay securely using UPI.</p>
        </div>
        {error && <p className="mb-6 text-center text-sm text-red-400">{error}</p>}
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.id} className={`flex min-h-[520px] flex-col rounded-2xl border bg-white/5 p-6 ${plan.featured ? "border-cyan-400 shadow-xl shadow-cyan-950/30" : "border-white/10"}`}>
              {plan.featured && <span className="rounded-full bg-cyan-400 px-3 py-1 text-xs font-bold text-black">POPULAR</span>}
              <h2 className="mt-3 text-xl font-semibold">{plan.name}</h2>
              <p className="mt-2 min-h-10 text-sm text-gray-400">{plan.description}</p>
              <div className="mt-5"><span className="text-4xl font-bold">₹{plan.price}</span>{plan.price > 0 && <span className="text-gray-400"> one-time</span>}</div>
              <p className="mt-2 text-sm text-cyan-300">{plan.requests.toLocaleString()} AI requests/day</p>
              <ul className="mt-5 min-h-32 flex-1 space-y-2 text-sm text-gray-300">{plan.benefits.map((benefit) => <li key={benefit}>✓ {benefit}</li>)}</ul>
              <button onClick={() => buyPlan(plan)} disabled={plan.id === "free" || Boolean(loadingPlan)} className="mt-6 min-h-12 w-full rounded-lg bg-cyan-500 px-4 py-3 font-semibold text-black disabled:bg-white/10 disabled:text-gray-500">
                {plan.id === "free" ? "Current free plan" : loadingPlan === plan.id ? "Opening UPI checkout..." : "Buy with UPI"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
