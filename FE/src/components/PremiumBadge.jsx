import { Crown } from "lucide-react";

export default function PremiumBadge({ size = "md", className = "" }) {
  const isSm = size === "sm";
  const isLg = size === "lg";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-black uppercase tracking-wider rounded-full shadow-sm select-none ${
        isSm
          ? "px-2 py-0.5 text-[9px] bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 text-amber-950 shadow-amber-200/50"
          : isLg
          ? "px-3.5 py-1.5 text-xs bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 text-amber-950 shadow-amber-300/50"
          : "px-2.5 py-1 text-[10px] bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 text-amber-950 shadow-amber-200/50"
      } ${className}`}
      title="Tài khoản Local Premium đã được xác minh ưu tiên"
    >
      <Crown
        size={isSm ? 11 : isLg ? 15 : 13}
        className="fill-amber-950 text-amber-950 shrink-0 animate-pulse"
      />
      <span>Local Premium</span>
    </span>
  );
}

