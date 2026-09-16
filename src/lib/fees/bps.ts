/**
 * Canonical basis-point arithmetic for every OrbitX revenue fee, on every chain.
 *
 * One implementation so Solana and Arc cannot drift apart, and so the figure a
 * user is shown is produced by the same code that decides what is collected.
 * Pure: no chain SDK, no "server-only" — importable by a route, a test, or the UI.
 */

/** Floor division, deliberately. */
export function applyBps(grossRaw: bigint, bps: number): bigint {
  assertBps(bps);
  if (grossRaw < 0n) throw new Error("Amount cannot be negative.");
  return (grossRaw * BigInt(bps)) / 10_000n;
}

export function assertBps(bps: number) {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    throw new Error(`Invalid fee bps: ${bps}`);
  }
}

/**
 * Split gross into fee + net using floor division, so the collected fee is never
 * larger than the quoted fee. Rounding always favours the user.
 */
export function splitByBps(grossRaw: bigint, bps: number) {
  if (grossRaw <= 0n) throw new Error("Enter an amount above zero.");
  const feeRaw = applyBps(grossRaw, bps);
  return { grossRaw, feeRaw, netRaw: grossRaw - feeRaw };
}
