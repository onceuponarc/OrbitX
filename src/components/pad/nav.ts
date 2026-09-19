export const APP_TABS = [
  { href: "/", label: "Board", match: "/" },
  { href: "/trade", label: "Trade", match: "/trade" },
  { href: "/launch", label: "Launch", match: "/launch", primary: true },
  { href: "/wallet", label: "Wallet", match: "/wallet" },
  { href: "/you", label: "You", match: "/you" },
] as const;

export const DESKTOP_NAV = [
  {
    group: "Pad",
    items: [
      { href: "/", label: "Board", match: "/" },
      { href: "/launch", label: "Launch", match: "/launch" },
      { href: "/trade", label: "Trade", match: "/trade" },
      { href: "/wallet", label: "Wallet", match: "/wallet" },
    ],
  },
  {
    group: "Create",
    items: [
      { href: "/drop", label: "Drop", match: "/drop" },
    ],
  },
  {
    group: "Desk",
    items: [
      { href: "/you", label: "You", match: "/you" },
      { href: "/week", label: "Week", match: "/week" },
      { href: "/tools", label: "Tools", match: "/tools" },
    ],
  },
  {
    group: "Official",
    items: [
      { href: "/params", label: "$ORBITX", match: "/params" },
      { href: "/whitepaper", label: "Whitepaper", match: "/whitepaper" },
      { href: "/links", label: "Links", match: "/links" },
    ],
  },
] as const;

export function navActive(pathname: string, href: string, match?: string) {
  if (href === "/") return pathname === "/";
  const base = match ?? href;
  return pathname === href || pathname.startsWith(`${base}/`) || pathname === base;
}
