import { DeepSpaceField } from "@/components/pad/deep-space-field";

export function PadBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#07080c]">
      <DeepSpaceField className="absolute inset-0 h-full w-full opacity-28" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_-8%,rgba(214,255,61,0.14),transparent_36%),radial-gradient(circle_at_92%_0%,rgba(255,90,31,0.16),transparent_38%),linear-gradient(180deg,#07080c_0%,#0b0d12_58%,#120b0a_100%)]" />
      <div className="pad-vignette absolute inset-0" />
    </div>
  );
}
