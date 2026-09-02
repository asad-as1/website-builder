"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { 
  Zap, 
  Shield, 
  Layout, 
  Rocket, 
  Star, 
  Users,
  ArrowRight,
  CheckCircle,
  Sparkles,
  Code,
  Cloud,
  Award,
  ChevronRight,
  Play,
  Layers
} from "lucide-react";
import { motion } from "framer-motion";

export default function HomePage() {
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated";

  const features = [
    {
      icon: <Sparkles className="w-6 h-6 text-cyan-400" />,
      title: "AI-Powered Generation",
      description: "Just describe your website, and our AI builds it in seconds.",
      gradient: "from-cyan-500/20 to-cyan-500/5"
    },
    {
      icon: <Layers className="w-6 h-6 text-purple-400" />,
      title: "No Code Required",
      description: "Zero coding skills needed. Perfect for designers and founders.",
      gradient: "from-purple-500/20 to-purple-500/5"
    },
    {
      icon: <Shield className="w-6 h-6 text-emerald-400" />,
      title: "Production Ready",
      description: "Clean, optimized code that's ready to deploy anywhere.",
      gradient: "from-emerald-500/20 to-emerald-500/5"
    },
    {
      icon: <Rocket className="w-6 h-6 text-rose-400" />,
      title: "Instant Deploy",
      description: "One-click deployment to Vercel, Netlify, or any hosting.",
      gradient: "from-rose-500/20 to-rose-500/5"
    }
  ];

  const templates = [
    { name: "Portfolio", icon: "🎨", color: "from-pink-500 to-rose-500" },
    { name: "Restaurant", icon: "🍽️", color: "from-orange-500 to-amber-500" },
    { name: "Agency", icon: "🏢", color: "from-blue-500 to-indigo-500" },
    { name: "Blog", icon: "📝", color: "from-green-500 to-emerald-500" }
  ];

  const stats = [
    { icon: <Users className="w-5 h-5" />, value: "1,200+", label: "websites built" },
    { icon: <Star className="w-5 h-5" />, value: "4.9", label: "average rating" },
    { icon: <Rocket className="w-5 h-5" />, value: "Free", label: "to get started" }
  ];

  return (
    <main className="min-h-screen bg-[#0a0a0f] overflow-x-hidden">
      
      {/* ==================== HERO SECTION ==================== */}
      <section className="relative overflow-hidden px-4 pt-16 pb-20 md:pt-24 md:pb-32">
        {/* Animated Background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 -right-40 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-purple-500/5 to-cyan-500/5 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            {/* Left Column - Text */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-gray-300 mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span>AI-Powered Website Builder</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                Build Stunning Websites
                <span className="block gradient-text mt-1">with AI Magic</span>
              </h1>

              <p className="text-xl text-gray-400 max-w-lg mt-6 leading-relaxed">
                Describe your vision in plain English, and watch our AI generate a complete, production-ready website in seconds.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-4 mt-8">
                {isLoggedIn ? (
                  <Link
                    href="/dashboard"
                    className="group inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-semibold hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300 text-lg"
                  >
                    Go to Dashboard
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
                  </Link>
                ) : (
                  <Link
                    href="/register"
                    className="group inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-semibold hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300 text-lg"
                  >
                    Get Started — It's Free
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
                  </Link>
                )}

                <Link
                  href="#features"
                  className="px-8 py-4 border border-white/20 rounded-xl font-semibold hover:bg-white/5 transition-all duration-300 text-lg flex items-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  Explore Features
                </Link>
              </div>

              {!isLoggedIn && (
                <p className="text-sm text-gray-500 mt-6">
                  Already have an account?{" "}
                  <Link href="/login" className="text-cyan-400 hover:underline">
                    Log in
                  </Link>
                </p>
              )}

              {/* Stats */}
              <div className="flex flex-wrap gap-6 mt-8 pt-6 border-t border-white/5">
                {stats.map((stat, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-gray-400">{stat.icon}</span>
                    <span className="text-gray-400 font-semibold">{stat.value}</span>
                    <span className="text-gray-500 text-sm">{stat.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right Column - Animated Illustration */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative glass p-8 rounded-3xl border border-white/10">
                {/* Floating Elements */}
                <div className="absolute -top-4 -right-4 w-16 h-16 bg-cyan-500/20 rounded-full blur-2xl animate-pulse"></div>
                <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-purple-500/20 rounded-full blur-2xl animate-pulse delay-700"></div>

                <div className="relative z-10 space-y-4">
                  {/* Mock UI */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600"></div>
                      <span className="font-bold gradient-text">Genetix</span>
                    </div>
                    <div className="flex gap-1">
                      <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                    </div>
                  </div>

                  <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span>AI Prompt</span>
                    </div>
                    <p className="text-gray-300 mt-2 text-sm">
                      "A modern portfolio for a photographer named Sarah"
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 bg-white/5 rounded-lg border border-white/5 text-center">
                      <div className="text-2xl mb-1">🎨</div>
                      <p className="text-xs text-gray-400">Portfolio</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg border border-white/5 text-center">
                      <div className="text-2xl mb-1">🍽️</div>
                      <p className="text-xs text-gray-400">Restaurant</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg border border-white/5 text-center">
                      <div className="text-2xl mb-1">🏢</div>
                      <p className="text-xs text-gray-400">Agency</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 border-t border-white/5 pt-3">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      Production ready
                    </span>
                    <span className="flex items-center gap-1">
                      <Cloud className="w-3 h-3 text-blue-400" />
                      One-click deploy
                    </span>
                  </div>
                </div>
              </div>

              {/* Floating Badges */}
              <div className="absolute -top-6 -right-6 glass px-4 py-2 rounded-full border border-white/10 hidden lg:flex items-center gap-2 animate-bounce-slow">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-medium">AI Powered</span>
              </div>
              <div className="absolute -bottom-6 -left-6 glass px-4 py-2 rounded-full border border-white/10 hidden lg:flex items-center gap-2 animate-bounce-slow delay-300">
                <Rocket className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium">Free to Start</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ==================== FEATURES SECTION ==================== */}
      <section id="features" className="px-4 py-16 md:py-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold">Why Choose Genetix?</h2>
            <p className="text-gray-400 mt-4 max-w-2xl mx-auto">
              Everything you need to build a stunning website without writing a single line of code.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`group p-6 rounded-2xl bg-gradient-to-br ${feature.gradient} border border-white/10 hover:border-cyan-500/30 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl hover:shadow-cyan-500/5 cursor-default`}
              >
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:bg-white/10 transition">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== TEMPLATES SECTION ==================== */}
      <section id="templates" className="px-4 py-16 md:py-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold">Start with a Template</h2>
            <p className="text-gray-400 mt-4 max-w-2xl mx-auto">
              Choose from our collection of beautifully designed templates and customize them with AI.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {templates.map((template, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className={`group relative p-8 rounded-2xl bg-gradient-to-br ${template.color} bg-opacity-10 hover:scale-105 transition-all duration-300 cursor-pointer border border-white/10 hover:border-white/30 overflow-hidden`}
              >
                <div className="text-4xl mb-3">{template.icon}</div>
                <h3 className="text-lg font-semibold">{template.name}</h3>
                <p className="text-sm text-white/60 flex items-center gap-1 mt-1">
                  View template <ChevronRight className="w-4 h-4" />
                </p>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition"></div>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link
              href={isLoggedIn ? "/dashboard" : "/register"}
              className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition group"
            >
              View all templates
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </Link>
          </div>
        </div>
      </section>

      {/* ==================== SOCIAL PROOF / MARQUEE ==================== */}
      <section className="py-8 border-y border-white/5 overflow-hidden">
        <div className="flex gap-12 whitespace-nowrap animate-marquee">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex gap-12 items-center text-gray-500 text-sm font-medium">
              <span>✨ Trusted by 1,200+ developers</span>
              <span className="w-1 h-1 rounded-full bg-gray-600"></span>
              <span>⭐ 4.9/5 average rating</span>
              <span className="w-1 h-1 rounded-full bg-gray-600"></span>
              <span>🚀 Free to start</span>
              <span className="w-1 h-1 rounded-full bg-gray-600"></span>
              <span>🌐 AI-Powered</span>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== CTA SECTION ==================== */}
      <section className="px-4 py-16 md:py-24 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="glass p-8 md:p-12 rounded-3xl border border-white/10"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Build Your Website?
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
              Join thousands of creators who are building stunning websites with AI.
            </p>
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-semibold hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
              >
                Go to Dashboard
                <ArrowRight className="w-5 h-5" />
              </Link>
            ) : (
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-semibold hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
              >
                Get Started — It's Free
                <ArrowRight className="w-5 h-5" />
              </Link>
            )}
          </motion.div>
        </div>
      </section>

      {/* ==================== STYLES ==================== */}
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
        .animate-bounce-slow {
          animation: bounce 3s ease-in-out infinite;
        }
        .animate-bounce-slow.delay-300 {
          animation-delay: 0.3s;
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </main>
  );
}