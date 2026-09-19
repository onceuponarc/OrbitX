"use client";

import { Button } from "@/components/ui/button";
import {
  formatActionLine,
  formatDestinationLine,
  formatTriggerLine,
  RULE_STATUS_META,
  type AutomationRule,
} from "@/lib/custom-launch/automation";
import { cn } from "@/lib/utils";

export function RuleCard({
  rule,
  selected,
  onSelect,
  onEdit,
  onDuplicate,
  onToggle,
  onRename,
  onDelete,
}: {
  rule: AutomationRule;
  selected?: boolean;
  onSelect?: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      className={cn(
        "rounded-[1.25rem] border px-4 py-4 transition-colors",
        selected ? "border-gold/45 bg-gold/8" : "border-white/10 bg-black/20",
      )}
    >
      <button type="button" onClick={onSelect} className="flex w-full items-start justify-between gap-3 text-left">
        <span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">Rule</span>
          <span className="mt-1 block text-lg font-semibold tracking-tight">{rule.name || "Untitled rule"}</span>
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
            rule.status === "active" && "bg-buy/12 text-buy",
            rule.status === "draft" && "bg-white/8 text-white/50",
            rule.status === "paused" && "bg-gold/12 text-gold",
            rule.status === "completed" && "bg-white/8 text-white/40",
          )}
        >
          {RULE_STATUS_META[rule.status]}
        </span>
      </button>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <Row label="Trigger" value={formatTriggerLine(rule)} />
        <Row label="Action" value={formatActionLine(rule)} />
        <Row label="Destination" value={formatDestinationLine(rule)} />
        <Row label="Last execution" value={rule.lastExecution ?? "Never — preview only"} />
        <Row label="Next execution" value={rule.nextExecution ?? "Not scheduled"} />
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onEdit}>
          Edit
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onRename}>
          Rename
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDuplicate}>
          Duplicate
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onSelect}>
          View details
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onToggle}>
          {rule.status === "active" ? "Disable" : "Enable"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">{label}</dt>
      <dd className="mt-0.5 text-white/75">{value}</dd>
    </div>
  );
}
