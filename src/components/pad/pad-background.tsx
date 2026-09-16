import { DeepSpaceField } from "@/components/pad/deep-space-field";

export function PadBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#07131d]">
      <DeepSpaceField className="absolute inset-0 h-full w-full opacity-40" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(168,85,247,0.14),transparent_32%),linear-gradient(135deg,#07131d_0%,#0b1020_52%,#160b22_100%)]" />
      <div className="pad-vignette absolute inset-0" />
    </div>
  );
}
