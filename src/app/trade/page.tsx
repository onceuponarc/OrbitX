import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { TradePanel } from "@/components/token/trade-panel";
import { OFFICIAL_TOKEN } from "@/lib/official-token";
import { RiskFeeNotice } from "@/components/launch/beta-notice";
import { isHiddenTestLaunch } from "@/lib/feed";

export const dynamic = "force-dynamic";

async function loadTradableTokens() {
  try {
    const db = createServiceClient();
    const { data } = await db
      .from("stories")
      .select("slug, title, ticker, token_address, cover_url")
      .eq("chain", "solana")
      .eq("status", "live")
      .not("token_address", "is", null)
      .order("created_at", { ascending: false })
      .limit(24);
    return (data ?? []).filter((row) => !isHiddenTestLaunch(row));
  } catch {
    return [];
  }
}

export default async function TradePage({
  searchParams,
}: {
  searchParams: Promise<{ mint?: string; symbol?: string }>;
}) {
  const { profile } = await getSessionUser();
  const params = await searchParams;
  const tokens = await loadTradableTokens();
  const activeMint = params.mint || OFFICIAL_TOKEN.mint;
  const activeSymbol = params.symbol || "ORBITX";

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold/80">Trade</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Swap from the desk</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          Jupiter routing, signed by your in-app wallet. No popup. No leaving OrbitX.
        </p>
      </div>

      <div className="flex flex-col-reverse gap-4 lg:grid lg:grid-cols-[1fr_1.25fr]">
        <div className="pad-panel space-y-2 rounded-[1.4rem] p-3">
          <p className="px-1 text-xs text-white/40">OrbitX launches, or paste any mint.</p>
          <div className="space-y-1">
            <Link
              href={`/trade?mint=${OFFICIAL_TOKEN.mint}&symbol=${OFFICIAL_TOKEN.ticker}`}
              className="flex items-center justify-between rounded-xl px-3 py-3 text-sm hover:bg-white/5"
            >
              <span className="font-medium">${OFFICIAL_TOKEN.ticker}</span>
              <span className="truncate text-xs text-white/40">{OFFICIAL_TOKEN.name} · official</span>
            </Link>
            {tokens
              .filter((t) => t.token_address !== OFFICIAL_TOKEN.mint)
              .map((t) => (
              <Link
                key={t.slug}
                href={`/trade?mint=${t.token_address}&symbol=${t.ticker}`}
                className="flex items-center justify-between rounded-xl px-3 py-3 text-sm hover:bg-white/5"
              >
                <span className="font-medium">${t.ticker}</span>
                <span className="truncate text-xs text-white/40">{t.title}</span>
              </Link>
            ))}
          </div>
          <form action="/trade" className="mt-2 flex gap-2">
            <input
              name="mint"
              placeholder="Paste a Solana mint"
              className="h-11 flex-1 rounded-2xl border border-white/12 bg-transparent px-3 text-sm lg:h-9"
            />
            <button type="submit" className="h-11 rounded-2xl bg-gold px-4 text-sm font-semibold text-ink lg:h-9">
              Load
            </button>
          </form>
        </div>

        <TradePanel tokenMint={activeMint} tokenSymbol={activeSymbol} signedIn={Boolean(profile)} />
      </div>
      <RiskFeeNotice variant="trade" />
    </div>
  );
}
