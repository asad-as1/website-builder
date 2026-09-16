"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut, LayoutDashboard, FolderGit2, User, UserCircle, WandSparkles, Eye , Send, MessageSquare } from "lucide-react";
import LogoutModal from "./LogoutModal"; 

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false); 
  const [hasAvatarError, setHasAvatarError] = useState(false);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    setHasAvatarError(false);
  }, [session?.user?.image]);

  const navLinks = session
    ? [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/projects", label: "Projects", icon: FolderGit2 },
        { href: "/profile", label: "Profile", icon: UserCircle },
        { href: "/contact/history", label: "My Requests", icon: MessageSquare },
        ...(session?.user?.role === "adminasad90" ? [{ href: "/admin", label: "Admin", icon: UserCircle }] : []),
        { href: "/contact", label: "Contact", icon: Send },
      ]
    : [];

  const getUserAvatar = () => {
    if (session?.user?.image && !hasAvatarError) {
      return (
        <img
          src={session.user.image}
          alt="Profile"
          referrerPolicy="no-referrer"
          onError={() => setHasAvatarError(true)}
          className="w-7 h-7 rounded-full object-cover"
        />
      );
    }
    const name = session?.user?.name || "User";
    const initial = name.charAt(0).toUpperCase();
    return (
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-xs font-bold">
        {initial}
      </div>
    );
  };

  const getUserName = () => {
    const name = session?.user?.name || "User";
    const parts = name.split(" ");
    const wordCount = parts.length;
    
    if (wordCount >= 3) {
        return parts[0] + " " + parts[1];
    } else {
        return parts[0];
    }
};

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-[#0a0a0f]/95 backdrop-blur-xl shadow-lg shadow-purple-500/5"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              href="/"
              className="group flex items-center gap-2.5 text-xl font-bold transition-all duration-300 hover:scale-105"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25 group-hover:shadow-purple-500/40 transition-shadow">
                <span className="text-white text-sm font-black">G</span>
              </div>
              <span className="gradient-text">Genetix</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                    pathname === href
                      ? "bg-white/10 text-white"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}
            </nav>

            {/* Desktop Auth Buttons */}
            <div className="hidden md:flex items-center gap-3">
              {session ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                    {getUserAvatar()}
                    <span className="text-sm text-gray-300 hidden lg:block">
                      {getUserName()}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsLogoutModalOpen(true)} // ✅ Open modal
                    className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden lg:inline">Logout</span>
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/register"
                    className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-purple-600 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6 text-white" />
              ) : (
                <Menu className="w-6 h-6 text-white" />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          <div
            className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
              isMobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="py-4 space-y-1 border-t border-white/10">
              {navLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    pathname === href
                      ? "bg-white/10 text-white"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </Link>
              ))}

              {session ? (
                <>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsLogoutModalOpen(true);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200"
                  >
                    <User className="w-5 h-5" />
                    Log In
                  </Link>
                  <Link
                    href="/register"
                    className="flex items-center justify-center px-4 py-3 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-purple-600 transition-all duration-200"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      
      <LogoutModal 
        isOpen={isLogoutModalOpen} 
        onClose={() => setIsLogoutModalOpen(false)} 
      />
    </>
  );
}