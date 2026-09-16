import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PIECE_EXPLAINER, AUTHOR_FEE_EXPLAINER } from "@onceupon/config/copy";
import { findChain, SOLANA, type LaunchVenue } from "@onceupon/config/solana";
import { ARC_TESTNET } from "@onceupon/config/arc";
import { PAD_NAME, PUMPFUN_CURVE_REFERENCE, feesForVenue, venueLabel } from "@onceupon/config/launchpad";
import { catalogByCaip2, explorerUrlForPool } from "@onceupon/config/pools";
import { notFound } from "next/navigation";
import Link from "next/link";
import { explorerAddress, explorerTx } from "@/lib/solana/explorer";
import { LaunchLinks } from "@/components/story/launch-links";
import { LinkLp } from "@/components/story/link-lp";
import { ArcTrade } from "@/components/arc/arc-trade";
import { HoldersTable, PriceChart, StoryTape, type ChartTrade } from "@/components/story/market-panel";
import { getLocalArcStory } from "@/lib/arc/store";
import { LiveRefresh } from "@/components/pad/live-refresh";
import { ChapterJacket } from "@/components/story/chapter-jacket";
import { ShareChapter } from "@/components/story/share-chapter";
import { loadArcStory } from "@/lib/arc/persist";
import { chapterStartPriceUi, virtualQuoteUiFor } from "@onceupon/config/chapter";
import { viewCardsForStory } from "@/lib/cards/resolve";
import { CardRail } from "@/components/cards/card-rail";
import { DexScreenerEmbed } from "@/components/token/dexscreener-embed";
import { TokenChat } from "@/components/token/token-chat";
import { TradePanel } from "@/components/token/trade-panel";
import { EvmTrade } from "@/components/token/evm-trade";
import { RiskFeeNotice } from "@/components/launch/beta-notice";
import { ClaimFeesButton } from "@/components/token/claim-fees-button";

const STORY_SELECT =
  "id, title, ticker, blurb, engine, status, pair_label, author_bps, protocol_bps, snipe_tax_bps, vault_address, token_address, chain, venue, mint_decimals, created_tx, curve_quote_lamports, curve_token_raw, auto_buy_rewards, quote_decimals, graduation_quote_raw, author_user_id, cover_url, jacket_url, twitter_url, telegram_url, website_url, image_uri, metadata_uri, supply, reward_vault_lamports, quote_mint, curve_address, linked_pool_address, linked_pool_dex, linked_pool_label, users:author_user_id(handle, display_name, portrait_url)";
const STORY_SELECT_MIN =
  "id, title, ticker, blurb, engine, status, pair_label, author_bps, protocol_bps, vault_address, token_address, chain, venue, mint_decimals, created_tx, curve_quote_lamports, curve_token_raw, auto_buy_rewards, quote_decimals, graduation_quote_raw, author_user_id, cover_url, supply, reward_vault_lamports, quote_mint, users:author_user_id(handle, display_name, portrait_url)";

function mapLocalArc(local: NonNullable<ReturnType<typeof getLocalArcStory>>) {
  return {
    story: {
      id: local.id,
      title: local.title,
      ticker: local.ticker,
      blurb: local.blurb,
      engine: local.engine,
      status: local.status,
      pair_label: local.pairLabel,
      author_bps: local.authorBps,
      protocol_bps: local.protocolBps,
      snipe_tax_bps: 0,
      vault_address: local.curveAddress,
      token_address: local.tokenAddress,
      chain: "arc",
      venue: "spl",
      mint_decimals: 18,
      created_tx: local.createdTx,
      curve_quote_lamports: local.curveQuoteRaw,
      curve_token_raw: local.curveTokenRaw,
      auto_buy_rewards: false,
      quote_decimals: 6,
      graduation_quote_raw: local.graduationQuoteRaw,
      author_user_id: null,
      cover_url: local.coverUrl,
      quote_mint: local.quoteAddress,
      supply: local.supply,
      users: local.handle ? { handle: local.handle } : null,
    },
    bindings: [] as BindingRow[],
    trades: local.trades.map((trade) => ({
      at: trade.tradedAt,
      priceUsd: trade.priceUsd,
      side: trade.side,
      quoteUi: Number(trade.side === "buy" ? trade.amountIn : trade.amountOut) / 1e6,
    })),
    holders: holdersFromLocal(local.trades),
  };
}

async function loadStory(slug: string) {
  const local = await loadArcStory(slug);
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    if (local) return mapLocalArc(local);
    throw new Error("Supabase did not answer.");
  }
  const full = await supabase.from("stories").select(STORY_SELECT).eq("slug", slug).maybeSingle();
  const story =
    full.data ??
    (full.error
      ? (await supabase.from("stories").select(STORY_SELECT_MIN).eq("slug", slug).maybeSingle()).data
      : null);
  if (!story && !local) return { story: null, bindings: [] as BindingRow[], trades: [] as ChartTrade[], holders: [] as { address: string; bought: number; sold: number; net: number }[] };
  if (!story && local) return mapLocalArc(local);
  const { data: bindings } = await supabase
    .from("bindings")
    .select("id, kind, chain_caip2, pool_address, mechanism, is_primary, proof_url, depth_usd, quote_address")
    .eq("story_id", story!.id)
    .order("is_primary", { ascending: false });
  const { data: tradeRows } = await supabase
    .from("trades")
    .select("side, trader, amount_in, amount_out, traded_at, price_usd")
    .eq("story_id", story!.id)
    .order("traded_at", { ascending: true });
  const qDec = Number((story as { quote_decimals?: number }).quote_decimals ?? 6);
  const bDec = Number((story as { mint_decimals?: number }).mint_decimals ?? 6);
  const trades: ChartTrade[] = (tradeRows ?? []).map((row) => {
    const quoteUi = row.side === "buy" ? Number(row.amount_in ?? 0) / 10 ** qDec : Number(row.amount_out ?? 0) / 10 ** qDec;
    const tokens = row.side === "buy" ? Number(row.amount_out ?? 0) / 10 ** bDec : Number(row.amount_in ?? 0) / 10 ** bDec;
    return {
      at: String(row.traded_at),
      priceUsd: row.price_usd != null ? Number(row.price_usd) : tokens > 0 ? quoteUi / tokens : 0,
      side: row.side === "sell" ? "sell" : "buy",
      quoteUi,
    };
  });
  const holderMap = new Map<string, { address: string; bought: number; sold: number; net: number }>();
  for (const row of tradeRows ?? []) {
    const addr = String(row.trader ?? "unknown");
    const cur = holderMap.get(addr) ?? { address: addr, bought: 0, sold: 0, net: 0 };
    const tokens = row.side === "buy" ? Number(row.amount_out ?? 0) / 10 ** bDec : Number(row.amount_in ?? 0) / 10 ** bDec;
    if (row.side === "buy") cur.bought += tokens;
    else cur.sold += tokens;
    cur.net = cur.bought - cur.sold;
    holderMap.set(addr, cur);
  }
  return { story, bindings: bindings ?? [], trades, holders: [...holderMap.values()].sort((a, b) => b.net - a.net) };
}

function holdersFromLocal(trades: { trader: string; side: string; amountIn: string; amountOut: string }[]) {
  const map = new Map<string, { address: string; bought: number; sold: number; net: number }>();
  for (const trade of trades) {
    const cur = map.get(trade.trader) ?? { address: trade.trader, bought: 0, sold: 0, net: 0 };
    if (trade.side === "buy") cur.bought += Number(trade.amountOut) / 1e18;
    else cur.sold += Number(trade.amountIn) / 1e18;
    cur.net = cur.bought - cur.sold;
    map.set(trade.trader, cur);
  }
  return [...map.values()].sort((a, b) => b.net - a.net);
}

type BindingRow = {
  id: string;
  kind: string;
  chain_caip2: string;
  pool_address: string;
  mechanism: string | null;
  is_primary: boolean;
  proof_url: string | null;
  depth_usd: number | string | null;
  quote_address: string | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: `${slug} · ${PAD_NAME}` };
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { profile } = await getSessionUser();
  let story: Awaited<ReturnType<typeof loadStory>>["story"] = null;
  let bindings: Awaited<ReturnType<typeof loadStory>>["bindings"] = [];
  let trades: Awaited<ReturnType<typeof loadStory>>["trades"] = [];
  let holders: Awaited<ReturnType<typeof loadStory>>["holders"] = [];
  try {
    const loaded = await loadStory(slug);
    story = loaded.story;
    bindings = loaded.bindings;
    trades = loaded.trades;
    holders = loaded.holders;
  } catch (error) {
    console.error("Story load failed", error);
    const local = await loadArcStory(slug);
    if (!local) {
      return (
        <div className="glass mx-auto max-w-lg space-y-3 rounded-3xl border border-arc/25 p-8">
      <LiveRefresh />
          <h1 className="font-heading text-3xl font-bold">This Story could not load</h1>
          <p className="text-parchment/70">Supabase did not answer. Reload, then sign in with X if you were trading.</p>
        </div>
      );
    }
  }

  if (!story) notFound();

  const author = Array.isArray(story.users) ? story.users[0] : story.users;
  const engineLabel = story.engine === "author" ? "Creator fees" : "Holder claims";
  const statusLabel = story.status === "graduated" ? "Bonded" : story.status;
  const chain = story.chain ?? "arc";
  const chainCard = findChain(chain);
  const isAuthor = Boolean(profile && story.author_user_id === profile.id);
  const coverUrl = (story as { cover_url?: string | null }).cover_url;
  const twitterUrl = (story as { twitter_url?: string | null }).twitter_url ?? null;
  const telegramUrl = (story as { telegram_url?: string | null }).telegram_url ?? null;
  const websiteUrl = (story as { website_url?: string | null }).website_url ?? null;
  const metadataUri = (story as { metadata_uri?: string | null }).metadata_uri ?? null;
  const snipeTax = Number((story as { snipe_tax_bps?: number | null }).snipe_tax_bps ?? 0);
  const venueFees = feesForVenue((story.venue as LaunchVenue) ?? "spl", story.engine);
  const jackets = await viewCardsForStory(slug).catch(() => []);

  return (
    <div className="space-y-8">
      <LiveRefresh intervalMs={2000} />
      {story.status === "graduated" ? (
        <div className="rounded-3xl border border-white bg-white px-5 py-6 text-center text-black">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-black/45">Graduation ceremony</p>
          <p className="mt-2 text-2xl font-semibold">The curve closed. Reserved supply seeded the pool.</p>
          <p className="mt-1 text-sm text-black/55">Buys and sells now print on the deeper book.</p>
        </div>
      ) : null}
      <ChapterJacket
        ticker={story.ticker}
        title={story.title}
        blurb={story.blurb ?? ""}
        coverUrl={coverUrl ?? null}
        status={String(story.status)}
        handle={author && typeof author === "object" ? (author as { handle?: string }).handle : null}
        snipeTaxBps={snipeTax}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge>{PAD_NAME}</Badge>
          <Badge variant="outline">{venueLabel(story.venue, chain)}</Badge>
          <Badge>{engineLabel}</Badge>
          <Badge variant="outline">{story.pair_label}</Badge>
          <Badge variant="secondary">{statusLabel}</Badge>
          <Badge variant="outline">{chainCard?.title ?? chain}</Badge>
        </div>
        <ShareChapter ticker={story.ticker} slug={slug} />
      </div>
      {jackets.length ? (
        <CardRail cards={jackets} title="Paired jackets" />
      ) : (
        <Link
          href={`/cards/new?story=${encodeURIComponent(slug)}&ticker=${encodeURIComponent(String(story.ticker))}&title=${encodeURIComponent(String(story.title))}`}
          className="block rounded-2xl border border-white/10 px-5 py-4 text-sm text-white/60"
        >
          Print a press card on ${String(story.ticker)}. Coin and jacket stay separate. Card value tracks this MC.
        </Link>
      )}
      {story.token_address ? (
        <LaunchLinks
          mint={story.token_address}
          venue={story.venue}
          chain={chain}
          twitterUrl={twitterUrl}
          telegramUrl={telegramUrl}
          websiteUrl={websiteUrl}
          metadataUri={metadataUri}
        />
      ) : null}

      {chain !== "arc" ? (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-white/50">
              <p>Live chart, price, and buys/sells straight from the chain via DexScreener.</p>
              {story.token_address ? (
                <a
                  href={`https://www.geckoterminal.com/${chain === "solana" ? "solana" : "eth"}/tokens/${story.token_address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 underline"
                >
                  Also view on GeckoTerminal
                </a>
              ) : null}
            </div>
            <DexScreenerEmbed chain={chain} tokenAddress={story.token_address ?? null} />
          </div>
          {chain === "solana" && story.token_address ? (
            <div className="space-y-3">
              <TradePanel tokenMint={story.token_address} tokenSymbol={story.ticker} signedIn={Boolean(profile)} />
              <RiskFeeNotice variant="trade" />
            </div>
          ) : chain === "robinhood" && story.token_address ? (
            <EvmTrade
              chain="robinhood"
              token={story.token_address}
              curve={(story as { curve_address?: string | null }).curve_address ?? story.vault_address}
              symbol={story.ticker}
              quoteLabel="ETH"
            />
          ) : (
            <div className="flex h-fit flex-col items-center justify-center gap-2 rounded-3xl border border-white/10 p-6 text-center text-sm text-white/45">
              <p>This token has no recorded trading curve.</p>
            </div>
          )}
        </div>
      ) : null}

      {chain === "arc" ? (
        <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <PriceChart
            trades={trades}
            fallbackPrice={chapterStartPriceUi(virtualQuoteUiFor(), 1_073_000_000)}
            ticker={story.ticker}
          />
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Trade</CardTitle>
                <CardDescription>
                  Argus v4 launch records are live. Buy/sell is routed only through the launch-specific pool id and hook.
                  {snipeTax > 0 ? ` Opening tax ${(snipeTax / 100).toFixed(2)}% on early buys.` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {story.token_address ? (
                  <EvmTrade
                    chain="arc"
                    token={story.token_address}
                    symbol={story.ticker}
                    quoteLabel="USDC"
                  />
                ) : <p className="text-sm text-parchment/70">This token has no recorded address.</p>}
                {story.token_address ? (
                  <a
                    href={`https://arguspad.io/token/${story.token_address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-block text-sm underline"
                  >
                    Open this token on Argus
                  </a>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {chain === "arc" ? <StoryTape trades={trades} /> : <div />}
        <TokenChat slug={slug} viewerHandle={profile?.handle ?? null} />
      </div>

      {chain === "arc" ? <HoldersTable holders={holders} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Fees</CardTitle>
            <CardDescription>
              {story.engine === "author" ? AUTHOR_FEE_EXPLAINER : PIECE_EXPLAINER}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Author {(story.author_bps / 100).toFixed(2)}% · protocol{" "}
              {(story.protocol_bps / 100).toFixed(2)}%
              {snipeTax > 0 ? ` · snipe +${(snipeTax / 100).toFixed(2)}% first 15 min` : ""}
            </p>
            <p className="text-parchment/60">{venueFees.note}</p>
            {story.venue === "pumpfun" ? (
              <p className="text-parchment/55">
                Pump.fun curve reference: {(PUMPFUN_CURVE_REFERENCE.creatorBps / 100).toFixed(2)}% creator +{" "}
                {(PUMPFUN_CURVE_REFERENCE.protocolBps / 100).toFixed(2)}% protocol. This mint pays OrbitX’s
                protocol cut, not Pump.fun’s.
              </p>
            ) : null}
            <p>
              Quote {story.pair_label}
              {(story as { quote_mint?: string | null }).quote_mint
                ? ` · ${(story as { quote_mint?: string | null }).quote_mint}`
                : ""}
            </p>
            {story.auto_buy_rewards ? <p>Vault auto-buys the pair on each OrbitXers cut.</p> : null}
            {story.engine === "onceuponers" ? (
              <p>
                Holder pool{" "}
                {(
                  Number((story as { reward_vault_lamports?: number | string | null }).reward_vault_lamports ?? 0) /
                  10 ** Number(story.quote_decimals ?? 9)
                ).toLocaleString("en-US", { maximumFractionDigits: 6 })}{" "}
                {story.pair_label}. Author funds it. Holders claim by share of circulating supply.
              </p>
            ) : chain === "arc" ? (
              <p>No claim button. Creator fees push on each swap.</p>
            ) : (
              <div className="space-y-2">
                <p>
                  Solana creator fees accrue on pump.fun&apos;s side and are <strong className="text-white">not</strong>{" "}
                  pushed automatically — you have to claim them yourself. This claims every pump.fun token your
                  account created in one transaction, not just this one.
                </p>
                <ClaimFeesButton signedIn={Boolean(profile)} />
              </div>
            )}
            {(story as { supply?: number | string | null }).supply ? (
              <p>
                Supply {Number((story as { supply?: number | string | null }).supply).toLocaleString("en-US")} raw ·{" "}
                {Number(story.mint_decimals ?? 6)} decimals
              </p>
            ) : null}
            {story.token_address ? (
              <p>
                Mint{" "}
                <a
                  className="break-all text-gold hover:underline"
                  href={
                    chain === "arc"
                      ? `${ARC_TESTNET.explorer}/address/${story.token_address}`
                      : explorerAddress(story.token_address)
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  {story.token_address}
                </a>
              </p>
            ) : null}
            {story.created_tx ? (
              <p>
                <a
                  className="text-gold hover:underline"
                  href={
                    chain === "arc" ? `${ARC_TESTNET.explorer}/tx/${story.created_tx}` : explorerTx(story.created_tx)
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Launch transaction
                </a>
              </p>
            ) : null}
            <p>
              Curve{" "}
              {(Number(story.curve_quote_lamports ?? 0) / 10 ** Number(story.quote_decimals ?? 9)).toLocaleString(
                "en-US",
                { maximumFractionDigits: 4 },
              )}{" "}
              /{" "}
              {(
                Number(story.graduation_quote_raw ?? SOLANA.bondingGraduationSol * 1_000_000_000) /
                10 ** Number(story.quote_decimals ?? 9)
              ).toLocaleString("en-US")}{" "}
              {story.pair_label}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Author</CardTitle>
          </CardHeader>
          <CardContent>
            {author && "handle" in author ? (
              <Link href={`/u/${author.handle}`} className="text-gold hover:underline">
                @{String(author.handle)}
              </Link>
            ) : (
              <p>Unknown OrbitXer</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Token</CardTitle>
          <CardDescription>
            The bonding curve is the market from T0. Buyers pay USDC into the vault. Graduation opens the Arc pool from
            those reserves. The creator does not seed an AMM at launch.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-parchment/70">
          {chain === "arc" ? (
            <p>Trade on the curve above. Quote is USDC on Arc.</p>
          ) : (
            <p>
              This token trades on {chainCard?.title ?? chain}&apos;s own market (pump.fun / PumpSwap for Solana),
              not an OrbitX curve — the chart and live trades above come straight from the chain.
            </p>
          )}
        </CardContent>
      </Card>

      {chain === "arc" ? (
      <Card>
        <CardHeader>
          <CardTitle>The Binding</CardTitle>
          <CardDescription>
            Graduation opens the Arc book from the vault. Binding an existing market is not this Story’s pool.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!bindings?.length ? (
            <p className="text-parchment/65">
              No AMM yet. The Chapter is live against {story.pair_label}. That quote market is hop-1 routing, not this
              mint’s pool. The book opens from the vault at graduation.
            </p>
          ) : (
            <ul className="space-y-2">
              {bindings.map((binding) => {
                const catalog = catalogByCaip2(binding.chain_caip2);
                const href = binding.proof_url || explorerUrlForPool(binding.chain_caip2, binding.pool_address);
                const depth = Number(binding.depth_usd ?? 0);
                return (
                  <li key={binding.id} className="rounded-xl border border-gold/15 bg-black/20 px-3 py-2">
                    <p className="font-medium text-parchment">
                      {binding.is_primary ? "Chapter · " : "Hop-1 · "}
                      {binding.mechanism ?? binding.kind.replaceAll("_", " ")} ·{" "}
                      {catalog?.title ?? binding.chain_caip2}
                    </p>
                    <a
                      className="mt-1 block break-all font-mono text-xs text-gold hover:underline"
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {binding.pool_address}
                    </a>
                    {depth > 0 ? (
                      <p className="mt-1 text-xs text-parchment/50">
                        ${depth.toLocaleString("en-US", { maximumFractionDigits: 0 })} depth
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {isAuthor && chain !== "arc" ? (
            <div className="pt-2">
              <LinkLp
                slug={slug}
                ticker={story.ticker}
                tokenMint={story.token_address}
                quoteMint={(story as { quote_mint?: string | null }).quote_mint ?? null}
                pairLabel={story.pair_label}
                boundAddresses={bindings.map((item) => item.pool_address)}
                venue={story.venue ?? "spl"}
                curveTokenRaw={(story as { curve_token_raw?: string | number | null }).curve_token_raw ?? 0}
                mintDecimals={Number(story.mint_decimals ?? 6)}
                storyStatus={story.status}
                curveQuoteRaw={(story as { curve_quote_lamports?: string | number | null }).curve_quote_lamports ?? 0}
                graduationQuoteRaw={
                  (story as { graduation_quote_raw?: string | number | null }).graduation_quote_raw ?? 0
                }
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
      ) : null}
    </div>
  );
}
