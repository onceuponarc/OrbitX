/** Local demo artifacts only. Replace this module when a real print is wired. */
export const MOCK_DEPLOY_DISCLAIMER =
  "MOCK / DEMO values. Nothing was broadcast. No token, pool, or transaction exists.";

export type MockDeployStageId =
  | "validate"
  | "token"
  | "market"
  | "router"
  | "automation"
  | "prepare"
  | "markets"
  | "activate";

export type MockDeployStage = {
  id: MockDeployStageId;
  label: string;
};

export const MOCK_DEPLOY_STAGES: MockDeployStage[] = [
  { id: "validate", label: "Configuration validated" },
  { id: "token", label: "Token configuration prepared" },
  { id: "market", label: "Market configuration prepared" },
  { id: "router", label: "Fee router prepared" },
  { id: "automation", label: "Automation configuration prepared" },
  { id: "prepare", label: "Preparing deployment" },
  { id: "markets", label: "Creating markets" },
  { id: "activate", label: "Activating automation" },
];

export type MockDeployResult = {
  tokenAddress: string;
  poolAddress: string;
  launchId: string;
  transaction: string;
};

export function createMockDeployResult(symbol: string, chain: string, quote: string): MockDeployResult {
  const ticker = symbol.trim().toUpperCase() || "TOKEN";
  const suffix = `${chain}-${ticker}`.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 18);
  return {
    tokenAddress: `MOCK_TOKEN_${ticker}`,
    poolAddress: `MOCK_POOL_${ticker}_${quote.toUpperCase()}`,
    launchId: `MOCK-LAUNCH-${suffix}`,
    transaction: "MOCK_TX_NOT_BROADCAST",
  };
}
