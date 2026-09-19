"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Rocket } from "lucide-react";

export default function Footer() {
  const pathname = usePathname();
  const currentYear = new Date().getFullYear();

  // ✅ Chat room aur editor pages pe footer hide karo
  const hideFooter =
    pathname?.startsWith("/chat/") ||
    pathname?.startsWith("/admin/chat/") ||
    pathname?.startsWith("/editor/");

  if (hideFooter) return null;

  const footerLinks = {
    product: [
      { name: "Features", href: "/" },
      { name: "Templates", href: "/" },
      { name: "Pricing", href: "/" },
      { name: "Changelog", href: "/" },
    ],
    company: [
      { name: "About", href: "/" },
      { name: "Blog", href: "/" },
      { name: "Careers", href: "/" },
      { name: "Contact", href: "/" },
    ],
    resources: [
      { name: "Documentation", href: "/" },
      { name: "Help Center", href: "/" },
      { name: "Community", href: "/" },
      { name: "Status", href: "/" },
    ],
    legal: [
      { name: "Privacy", href: "/" },
      { name: "Terms", href: "/" },
      { name: "Cookies", href: "/" },
      { name: "License", href: "/" },
    ],
  };

  return (
    <footer className="border-t border-white/5 bg-[#0a0a0f]">
      <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
        {/* Top Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 text-xl font-bold">
              {/* ✅ Logo Image */}
              <img
                src="/logo.png"
                alt="Genetix"
                className="w-12 h-12 rounded-full object-cover shadow-lg shadow-purple-500/25"
              />
              <span className="gradient-text">Genetix</span>
            </Link>
            <p className="text-gray-500 text-sm mt-3 max-w-xs">
              Build stunning websites with AI in minutes. No code required.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-4">Product</h4>
            <ul className="space-y-2.5">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-sm text-gray-500 hover:text-gray-300 transition">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-4">Company</h4>
            <ul className="space-y-2.5">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-sm text-gray-500 hover:text-gray-300 transition">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-4">Resources</h4>
            <ul className="space-y-2.5">
              {footerLinks.resources.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-sm text-gray-500 hover:text-gray-300 transition">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm mt-3 max-w-xs">
            Built with ❤️ by{" "}
            <span className="text-gray-300 font-medium">Mohd Asad Ansari</span>
          </p>

          {/* Tech Badges */}
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              AI-Powered
            </span>
            <span className="w-px h-3 bg-white/10"></span>
            <span className="flex items-center gap-1">
              <Rocket className="w-3 h-3 text-rose-400" />
              v1.0.0
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}