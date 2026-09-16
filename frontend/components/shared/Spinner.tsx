"use client";

interface SpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  text?: string;
  fullScreen?: boolean;
}

const sizeMap = {
  sm: "h-5 w-5 border-2",
  md: "h-8 w-8 border-[3px]",
  lg: "h-12 w-12 border-4",
  xl: "h-16 w-16 border-4",
};

export default function Spinner({ size = "lg", text, fullScreen = false }: SpinnerProps) {
  const spinner = (
    <div className="flex flex-col items-center justify-center gap-4 text-center">
      <span
        className={`${sizeMap[size]} animate-spin rounded-full border-cyan-300/20 border-t-cyan-300`}
      />
      {text && <p className="text-sm text-gray-400">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        {spinner}
      </div>
    );
  }

  return spinner;
}