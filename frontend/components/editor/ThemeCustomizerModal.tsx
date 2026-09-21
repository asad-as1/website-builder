"use client";

import { useState } from "react";
import { Palette, Check, Sparkles, X, Type, Shapes } from "lucide-react";

interface ThemeCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTheme: (instruction: string) => Promise<void>;
  isApplying: boolean;
}

const colorThemes = [
  {
    id: "cyberpunk",
    name: "Cyberpunk Neon",
    description: "Vibrant neon cyan & electric purple with dark glowing borders",
    primary: "#06b6d4",
    secondary: "#a855f7",
    bg: "#0a0a0f",
  },
  {
    id: "midnight",
    name: "Midnight Slate",
    description: "Clean modern monochrome slate with sharp white accents",
    primary: "#f8fafc",
    secondary: "#64748b",
    bg: "#09090b",
  },
  {
    id: "emerald",
    name: "Emerald Luxury",
    description: "Deep forest emerald, fresh mint highlights, and organic warmth",
    primary: "#10b981",
    secondary: "#047857",
    bg: "#06130d",
  },
  {
    id: "sunset",
    name: "Sunset Coral",
    description: "Warm golden amber, coral rose gradients, and modern energy",
    primary: "#f59e0b",
    secondary: "#f43f5e",
    bg: "#13090b",
  },
  {
    id: "royal",
    name: "Royal Tech",
    description: "Deep indigo, vibrant sky blue, and enterprise SaaS aesthetics",
    primary: "#6366f1",
    secondary: "#38bdf8",
    bg: "#090b16",
  },
];

const fontFamilies = [
  { id: "inter", name: "Inter", style: "Clean & Modern Sans" },
  { id: "jakarta", name: "Plus Jakarta Sans", style: "Friendly Tech & Startup" },
  { id: "playfair", name: "Playfair Display", style: "Luxury Editorial Serif" },
  { id: "mono", name: "JetBrains Mono", style: "Developer & Terminal Aesthetic" },
];

const borderRadii = [
  { id: "sharp", name: "Sharp", value: "0px", label: "Angular & Modernist" },
  { id: "rounded", name: "Rounded", value: "12px", label: "Smooth & Balanced" },
  { id: "pill", name: "Pill", value: "9999px", label: "Curved & Playful" },
];

export default function ThemeCustomizerModal({
  isOpen,
  onClose,
  onApplyTheme,
  isApplying,
}: ThemeCustomizerModalProps) {
  const [selectedTheme, setSelectedTheme] = useState(colorThemes[0].id);
  const [selectedFont, setSelectedFont] = useState(fontFamilies[0].id);
  const [selectedRadius, setSelectedRadius] = useState(borderRadii[1].id);

  if (!isOpen) return null;

  const handleApply = async () => {
    const themeObj = colorThemes.find((t) => t.id === selectedTheme) || colorThemes[0];
    const fontObj = fontFamilies.find((f) => f.id === selectedFont) || fontFamilies[0];
    const radiusObj = borderRadii.find((r) => r.id === selectedRadius) || borderRadii[1];

    const instruction = `Update website theme and visual styling: Use ${themeObj.name} color palette (${themeObj.primary} primary and ${themeObj.secondary} accent on ${themeObj.bg} background), set typography to ${fontObj.name} (${fontObj.style}), and adjust button/card corner radius to ${radiusObj.name} (${radiusObj.value}).`;

    await onApplyTheme(instruction);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#12121f] p-6 sm:p-8 shadow-2xl relative text-white max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          disabled={isApplying}
          className="absolute right-5 top-5 p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Theme & Style Customizer</h2>
            <p className="text-xs text-gray-400">
              Transform the color palette, fonts, and button shapes of your generated website.
            </p>
          </div>
        </div>

        {/* 1. Color Theme Selection */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-300 mb-2.5 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-cyan-400" />
            Color Palette
          </label>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {colorThemes.map((theme) => {
              const isSelected = selectedTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setSelectedTheme(theme.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left transition cursor-pointer ${
                    isSelected
                      ? "bg-white/10 border-cyan-400 shadow-md shadow-cyan-500/10"
                      : "bg-white/5 border-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="flex -space-x-1.5 shrink-0 mt-0.5">
                    <span
                      className="w-5 h-5 rounded-full border border-black/40 shadow-sm"
                      style={{ backgroundColor: theme.primary }}
                    />
                    <span
                      className="w-5 h-5 rounded-full border border-black/40 shadow-sm"
                      style={{ backgroundColor: theme.secondary }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white truncate">
                        {theme.name}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </div>
                    <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">
                      {theme.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Typography Selection */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-300 mb-2.5 flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-purple-400" />
            Typography
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {fontFamilies.map((font) => {
              const isSelected = selectedFont === font.id;
              return (
                <button
                  key={font.id}
                  type="button"
                  onClick={() => setSelectedFont(font.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
                    isSelected
                      ? "bg-purple-500/15 border-purple-400 shadow-sm"
                      : "bg-white/5 border-white/5 hover:border-white/20"
                  }`}
                >
                  <div>
                    <span className="text-xs font-semibold text-white block">{font.name}</span>
                    <span className="text-[10px] text-gray-400">{font.style}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Border Radius */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-300 mb-2.5 flex items-center gap-1.5">
            <Shapes className="w-3.5 h-3.5 text-emerald-400" />
            Corner Rounding
          </label>
          <div className="grid grid-cols-3 gap-2">
            {borderRadii.map((radius) => {
              const isSelected = selectedRadius === radius.id;
              return (
                <button
                  key={radius.id}
                  type="button"
                  onClick={() => setSelectedRadius(radius.id)}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                    isSelected
                      ? "bg-emerald-500/15 border-emerald-400"
                      : "bg-white/5 border-white/5 hover:border-white/20"
                  }`}
                >
                  <span className="text-xs font-semibold text-white block">{radius.name}</span>
                  <span className="text-[10px] text-gray-400 block mt-0.5">{radius.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium text-gray-300 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isApplying}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 text-sm font-semibold text-white shadow-lg transition cursor-pointer disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isApplying ? "Applying Styles..." : "Apply Theme to Project"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
