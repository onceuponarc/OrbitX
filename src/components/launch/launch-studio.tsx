"use client";

import { ArcLaunchStudio } from "@/components/launch/arc-launch-studio";
import type { PrintableChain } from "@onceupon/config/solana";

export function LaunchStudio({
  handle,
}: {
  chain: PrintableChain;
  handle: string | null;
  signedIn: boolean;
}) {
  return <ArcLaunchStudio handle={handle} />;
}
