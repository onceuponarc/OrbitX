import { notFound } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { loadLaunchBySlug, loadPublicExecutions, publicLaunchView } from "@/lib/custom-launch/persist";
import { formatBps } from "@/lib/custom-launch/schema";
import { FEE_DESTINATIONS, type FeeDestinationId } from "@/lib/custom-launch/fees";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  try {
    const launch = await loadLaunchBySlug(slug);
    if (!launch || (launch.status !== "live" && launch.status !== "paused")) return { title: "Custom Launch" };
    return { title: `${launch.token_name} ($${launch.token_symbol})` };
  } catch {
    return { title: "Custom Launch" };
  }
}

const PUBLIC_ACTIONS: Record<string, string> = {
  buyback: "Buyback",
  burn: "Burn",
  buyback_burn: "Buyback & burn",
  add_liquidity: "Liquidity added",
  holders: "Holder rewards",
  charity: "Charity",
  treasury: "Treasury",
  community: "Community",
  flywheel: "Flywheel",
};

export default async function CustomTokenPage({ params }: Props) {
  const { slug } = await params;
  const launch = await loadLaunchBySlug(slug);
  if (!launch || (launch.status !== "live" && launch.status !== "paused")) notFound();
  const view = await publicLaunchView(launch);
  const activity = await loadPublicExecutions(launch.id);
  const { user } = await getSessionUser();
  const isAuthor = Boolean(user && user.id === launch.author_user_id);
  const burns = activity.filter((row) => row.action === "burn" || row.action === "buyback_burn");

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 py-8">
      <section className="ox-console rounded-[1.5rem] p-6 sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold/80">
          Custom Launch · {view.chain}
        </p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">
              {view.tokenName} <span className="text-gold">${view.tokenSymbol}</span>
            </h1>
            {view.description ? <p className="mt-3 max-w-2xl text-sm text-white/60">{view.description}</p> : null}
          </div>
          {isAuthor ? (
            <Link
              href={`/custom/${slug}/dev`}
              className="rounded-full border border-gold/40 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-gold"
            >
              Dev desk
            </Link>
          ) : null}
        </div>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Meta label="Status" value={view.status} />
          <Meta label="Trading fee" value={formatBps(view.tradeFeeBps)} />
          <Meta label="Supply" value={view.supply} />
          <Meta label="Burn events" value={String(burns.length)} />
        </dl>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <AddressRow label="Token" value={view.tokenAddress ?? "—"} />
          <AddressRow label="Pool" value={view.poolAddress ?? "Not created on this chain"} />
          <AddressRow label="Deploy tx" value={view.deployTx ?? "—"} />
        </div>
        <Socials socials={view.socials} />
      </section>

      <section className="ox-console rounded-[1.5rem] p-6">
        <h2 className="text-xl font-semibold">Markets</h2>
        <p className="mt-1 text-sm text-white/45">
          Primary is created only when the chain has a Custom Launch pool. Secondary books are recorded, not deployed.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {view.markets.map((market, index) => (
            <li key={`${market.role}-${market.quote}-${index}`} className="rounded-2xl border border-white/10 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold capitalize">{market.role}</span>
                <span className="font-mono text-xs text-white/45">{market.status}</span>
              </div>
              <p className="mt-1 text-white/70">${view.tokenSymbol} / {market.quote.toUpperCase()}</p>
              {market.poolAddress ? (
                <p className="mt-1 break-all font-mono text-[11px] text-white/40">{market.poolAddress}</p>
              ) : (
                <p className="mt-1 text-xs text-white/40">No pool address on this chain.</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="ox-console rounded-[1.5rem] p-6">
        <h2 className="text-xl font-semibold">Fee destinations</h2>
        <p className="mt-1 text-sm text-white/45">Public split only. Vault keys and private rules are not shown.</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {view.splits
            .filter((row) => row.bps > 0)
            .map((row) => (
              <li key={row.dest} className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-sm">
                <span>{FEE_DESTINATIONS[row.dest as FeeDestinationId]?.label ?? row.dest}</span>
                <span className="font-mono text-gold">{formatBps(row.bps)}</span>
              </li>
            ))}
        </ul>
      </section>

      <section className="ox-console rounded-[1.5rem] p-6">
        <h2 className="text-xl font-semibold">Verified activity</h2>
        <p className="mt-1 text-sm text-white/45">Confirmed transactions only.</p>
        {activity.length === 0 ? (
          <p className="mt-4 text-sm text-white/40">No confirmed Custom Launch events yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {activity.map((row) => (
              <li key={row.id} className="rounded-2xl border border-white/10 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{PUBLIC_ACTIONS[row.action] ?? row.action}</p>
                  <p className="font-mono text-[11px] text-white/40">{row.confirmed_at ?? row.created_at}</p>
                </div>
                {row.tx_hash ? (
                  row.explorer_url ? (
                    <a href={row.explorer_url} target="_blank" rel="noreferrer" className="mt-1 block break-all font-mono text-xs text-gold/80">
                      {row.tx_hash}
                    </a>
                  ) : (
                    <p className="mt-1 break-all font-mono text-xs text-white/50">{row.tx_hash}</p>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">{label}</dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  );
}

function AddressRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-1 break-all font-mono text-xs text-white/70">{value}</p>
    </div>
  );
}

function Socials({
  socials,
}: {
  socials: { website: string; twitter: string; telegram: string; discord: string };
}) {
  const links = [
    { label: "Website", href: hrefFor(socials.website) },
    { label: "X", href: hrefFor(socials.twitter, "https://x.com/") },
    { label: "Telegram", href: hrefFor(socials.telegram, "https://t.me/") },
    { label: "Discord", href: hrefFor(socials.discord) },
  ].filter((row) => row.href);
  if (!links.length) return null;
  return (
    <ul className="mt-5 flex flex-wrap gap-2">
      {links.map((row) => (
        <li key={row.label}>
          <a
            href={row.href}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70 hover:text-white"
          >
            {row.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

function hrefFor(value: string, prefix?: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (prefix) return `${prefix}${raw.replace(/^@/, "")}`;
  return `https://${raw}`;
}
