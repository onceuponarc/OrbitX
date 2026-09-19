import type { LaunchStrategy } from "@/lib/custom-launch/modes";
import { cn } from "@/lib/utils";

export function modeAccent(strategy: LaunchStrategy) {
  switch (strategy.accent) {
    case "arc":
      return {
        icon: "text-arc",
        chip: "bg-arc/12 text-arc",
        selected: "border-arc/50 bg-arc/10",
        module: "border-arc/35 bg-arc/8",
        bar: "bg-arc",
      };
    case "heat":
      return {
        icon: "text-heat",
        chip: "bg-heat/12 text-heat",
        selected: "border-heat/50 bg-heat/10",
        module: "border-heat/35 bg-heat/8",
        bar: "bg-heat",
      };
    case "buy":
      return {
        icon: "text-buy",
        chip: "bg-buy/12 text-buy",
        selected: "border-buy/50 bg-buy/10",
        module: "border-buy/35 bg-buy/8",
        bar: "bg-buy",
      };
    case "teal":
      return {
        icon: "text-teal",
        chip: "bg-teal/12 text-teal",
        selected: "border-teal/50 bg-teal/10",
        module: "border-teal/35 bg-teal/8",
        bar: "bg-teal",
      };
    case "burgundy":
      return {
        icon: "text-burgundy",
        chip: "bg-burgundy/15 text-burgundy",
        selected: "border-burgundy/50 bg-burgundy/10",
        module: "border-burgundy/35 bg-burgundy/8",
        bar: "bg-burgundy",
      };
    case "cyan":
      return {
        icon: "text-arc",
        chip: "bg-arc/12 text-arc",
        selected: "border-arc/40 bg-[#12343a]",
        module: "border-arc/30 bg-[#0d2428]",
        bar: "bg-arc",
      };
    case "metal":
      return {
        icon: "text-white/80",
        chip: "bg-white/10 text-white/70",
        selected: "border-white/35 bg-white/8",
        module: "border-white/20 bg-white/5",
        bar: "bg-white/70",
      };
    case "lime":
      return {
        icon: "text-gold",
        chip: "bg-gold/12 text-gold",
        selected: "border-gold/40 bg-[#1a2410]",
        module: "border-gold/25 bg-[#141c0e]",
        bar: "bg-gold",
      };
    case "advanced":
      return {
        icon: "text-gold",
        chip: "bg-gold/15 text-gold",
        selected: "border-gold/70 bg-gold/12 shadow-[0_0_40px_rgb(214_255_61/12%)]",
        module: "border-gold/40 bg-gold/8",
        bar: "bg-gold",
      };
    default:
      return {
        icon: "text-gold",
        chip: "bg-gold/12 text-gold",
        selected: "border-gold/50 bg-gold/10",
        module: "border-gold/30 bg-gold/8",
        bar: "bg-gold",
      };
  }
}

export function modeCardClass(strategy: LaunchStrategy, state: "idle" | "primary" | "module" | "inspect") {
  const accent = modeAccent(strategy);
  return cn(
    "group relative flex h-full flex-col rounded-[1.35rem] border px-4 py-4 text-left transition-all",
    strategy.advanced && "ox-console-metal",
    state === "idle" && "border-white/10 bg-black/20 hover:border-white/25 hover:bg-black/30",
    state === "primary" && accent.selected,
    state === "module" && accent.module,
    state === "inspect" && "border-white/30 bg-white/6",
  );
}
