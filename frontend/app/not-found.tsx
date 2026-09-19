import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <section
      className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4 relative overflow-hidden"
      style={{
        backgroundImage:
          "url(https://cdn.dribbble.com/users/285475/screenshots/2083086/dribbble_1.gif)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* ✅ Dark Overlay (text visible rakhne ke liye) */}
      <div className="absolute inset-0 bg-[#0a0a0f]/70 backdrop-blur-[2px]" />

      {/* ✅ Content — inside GIF */}
      <div className="relative z-10 max-w-3xl mx-auto text-center px-6">
        <h1 className="text-7xl md:text-9xl font-black gradient-text mb-4">
          404
        </h1>

        <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white">
          Look like you&apos;re{" "}
          <span className="gradient-text">lost</span>
        </h2>

        <p className="text-gray-300 text-lg md:text-xl mb-10 max-w-xl mx-auto">
          The page you are looking for is not available.
        </p>

        {/* ✅ Buttons — inside GIF area */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-semibold hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300 text-white"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-3 border border-white/30 bg-black/40 backdrop-blur-sm rounded-xl font-semibold hover:bg-white/10 transition-all duration-300 text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}