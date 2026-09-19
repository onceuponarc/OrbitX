/** Single mock source for the OrbitX protocol Custom Launch destination. */
export const ORBITX_PROTOCOL = {
  label: "OrbitX Protocol",
  destination: "4qD4UBf9y9wRM51qHYccucAJadB24PRSEku7JWpXV6wu",
  /** Locked share of Custom Launch trading fees. Replace when contracts bind. */
  allocationBps: 2500,
} as const;

export function shortenOrbitxDestination(
  address: string = ORBITX_PROTOCOL.destination,
  lead = 4,
  tail = 5,
) {
  if (address.length <= lead + tail + 3) return address;
  return `${address.slice(0, lead)}...${address.slice(-tail)}`;
}
