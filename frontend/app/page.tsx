// app/page.tsx
export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0a0a0f] to-[#1a1a2e] text-white flex items-center justify-center">
      <div className="text-center space-y-6 px-4">
        <h1 className="text-5xl md:text-7xl font-bold">
          <span className="bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent">
            AI Website Builder
          </span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Describe your site, and AI generates the layout, copy, and theme.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg font-semibold hover:scale-105 transition duration-300 shadow-lg shadow-purple-500/25">
            Get Started
          </button>
          <button className="px-6 py-3 border border-white/20 rounded-lg font-semibold hover:bg-white/10 transition duration-300">
            Watch Demo
          </button>
        </div>
      </div>
    </main>
  );
}