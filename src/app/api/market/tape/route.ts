import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { localTape } from "@/lib/arc/store";
import { isHiddenTestLaunch } from "@/lib/feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tape: {
    slug: string;
    ticker: string;
    side: "buy" | "sell";
    quoteUi: number;
    trader: string;
    at: string;
  }[] = localTape(24)
    .filter((item) => !isHiddenTestLaunch(item))
    .map((item) => ({
    slug: item.slug,
    ticker: item.ticker,
    side: item.side,
    quoteUi: item.quoteUi,
    trader: item.trader,
    at: item.at,
  }));
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("trades")
      .select("side, trader, amount_in, amount_out, traded_at, stories:story_id(slug, ticker, quote_decimals, pair_label, quote_mint, token_address)")
      .order("traded_at", { ascending: false })
      .limit(24);
    for (const row of data ?? []) {
      const story = Array.isArray(row.stories) ? row.stories[0] : row.stories;
      if (!story || typeof story !== "object" || !("slug" in story)) continue;
      const slug = String((story as { slug: string }).slug);
      const quote = String((story as { quote_mint?: string | null }).quote_mint ?? "").toLowerCase();
      if (isHiddenTestLaunch({ slug, ticker: String((story as { ticker?: string }).ticker ?? ""), quoteAddress: quote, tokenAddress: String((story as { token_address?: string }).token_address ?? "") })) {
        continue;
      }
      const quoteDecimals = Number((story as { quote_decimals?: number }).quote_decimals ?? 6);
      const amountIn = Number(row.amount_in ?? 0);
      const quoteUi =
        row.side === "buy" ? amountIn / 10 ** quoteDecimals : Number(row.amount_out ?? 0) / 10 ** quoteDecimals;
      tape.push({
        slug: String((story as { slug: string }).slug),
        ticker: String((story as { ticker: string }).ticker),
        side: row.side === "sell" ? "sell" : "buy",
        quoteUi,
        trader: String(row.trader ?? ""),
        at: String(row.traded_at),
      });
    }
  } catch (error) {
    console.error("tape load failed", error);
  }
  tape.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  return NextResponse.json({ tape: tape.slice(0, 24) }, { headers: { "Cache-Control": "no-store" } });
}
