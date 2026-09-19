import {
  Briefcase,
  CircuitBoard,
  Flame,
  Globe,
  Heart,
  Landmark,
  RefreshCw,
  SlidersHorizontal,
  Undo2,
  Users,
  Waves,
} from "lucide-react";
import type { LaunchStrategyId } from "@/lib/custom-launch/modes";
import { cn } from "@/lib/utils";

const ICONS: Record<LaunchStrategyId, typeof SlidersHorizontal> = {
  standard: SlidersHorizontal,
  flywheel: RefreshCw,
  bagwork: Briefcase,
  holders: Users,
  charity: Heart,
  buyback: Undo2,
  burn: Flame,
  liquidity: Waves,
  treasury: Landmark,
  community: Globe,
  custom: CircuitBoard,
};

export function ModeIcon({
  id,
  className,
}: {
  id: LaunchStrategyId;
  className?: string;
}) {
  const Icon = ICONS[id];
  return <Icon className={cn("size-5", className)} aria-hidden />;
}
