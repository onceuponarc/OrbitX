/** True when any pump.fun creator vault still holds unclaimed quote. */
export function vaultsHaveClaimableFees(balances: { total: { isZero(): boolean } }[]): boolean {
  return balances.some((row) => !row.total.isZero());
}
