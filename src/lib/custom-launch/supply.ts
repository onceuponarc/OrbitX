export const SUPPLY_BUCKET_IDS = [
  "creator",
  "liquidity",
  "community",
  "treasury",
  "marketing",
  "rewards",
  "other",
] as const;

export type SupplyBucketId = (typeof SUPPLY_BUCKET_IDS)[number];

export type SupplyAllocation = {
  id: SupplyBucketId;
  label: string;
  bps: number;
};

export type SupplyPlan = {
  allocations: SupplyAllocation[];
};

export const SUPPLY_BUCKETS: { id: SupplyBucketId; label: string }[] = [
  { id: "creator", label: "Creator" },
  { id: "liquidity", label: "Liquidity" },
  { id: "community", label: "Community" },
  { id: "treasury", label: "Treasury" },
  { id: "marketing", label: "Marketing" },
  { id: "rewards", label: "Rewards" },
  { id: "other", label: "Other" },
];

export function createSupplyPlan(): SupplyPlan {
  return {
    allocations: [
      { id: "creator", label: "Creator", bps: 1000 },
      { id: "liquidity", label: "Liquidity", bps: 2000 },
      { id: "community", label: "Community", bps: 4000 },
      { id: "treasury", label: "Treasury", bps: 2000 },
      { id: "marketing", label: "Marketing", bps: 0 },
      { id: "rewards", label: "Rewards", bps: 1000 },
      { id: "other", label: "Other", bps: 0 },
    ],
  };
}

export function supplyAllocatedBps(plan: SupplyPlan) {
  return plan.allocations.reduce((sum, row) => sum + row.bps, 0);
}

export function supplyRemainingBps(plan: SupplyPlan) {
  return 10_000 - supplyAllocatedBps(plan);
}

export function supplyPlanBalanced(plan: SupplyPlan) {
  return supplyAllocatedBps(plan) === 10_000;
}

export function unitsForShare(supply: string, bps: number) {
  const total = Number(supply.replace(/[^\d]/g, ""));
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.floor((total * bps) / 10_000);
}
