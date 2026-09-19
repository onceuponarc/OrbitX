import Image from "next/image";
import Link from "next/link";
import { CARD_FLYWHEELS } from "@/lib/cards/types";
import { OFFICIAL_TOKEN } from "@/lib/official-token";

export const metadata = {
  title: "Whitepaper",
  description: "How OrbitX works: chains, desk wallets, Press Cards, trading, and $ORBITX.",
};

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-white/10 pt-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-arc/70">{n}</p>
      <h2 className="font-display mt-2 text-3xl sm:text-4xl">{title}</h2>
      <div className="mt-4 space-y-4 text-base leading-7 text-white/70">{children}</div>
    </section>
  );
}

export default function WhitepaperPage() {
  return (
    <article className="mx-auto max-w-3xl">
      <div className="relative -mx-4 h-52 overflow-hidden rounded-b-[2rem] sm:h-72">
        <Image src="/brand/banner.jpg" alt="" fill priority className="object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
      </div>

      <div className="-mt-14 flex items-end gap-4 px-1 sm:-mt-16">
        <Image
          src="/brand/logo.jpg"
          alt="OrbitX"
          width={88}
          height={88}
          className="rounded-2xl border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
        />
        <div className="pb-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">Whitepaper</p>
          <h1 className="font-display text-3xl sm:text-4xl">OrbitX</h1>
        </div>
      </div>

      <p className="mt-6 text-lg leading-8 text-white/75">
        OrbitX is a multi-chain launchpad: one desk, one in-app wallet per chain, three real venues to print a
        token on — Solana, Arc, and Robinhood Chain. This page documents how it actually works today, not a
        roadmap of what might exist someday.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-xs text-white/45">
        <Link href="/terms" className="rounded-full border border-white/10 px-3 py-1 hover:border-white/25">
          Terms
        </Link>
        <Link href="/privacy" className="rounded-full border border-white/10 px-3 py-1 hover:border-white/25">
          Privacy
        </Link>
        <Link href="/params" className="rounded-full border border-white/10 px-3 py-1 hover:border-white/25">
          $ORBITX
        </Link>
      </div>

      <div className="mt-10 space-y-10 pb-16">
        <Section n="01" title="Why OrbitX exists">
          <p>
            Launching a token today usually means picking one chain, learning that chain&apos;s wallet, and trusting a
            bonding-curve UI you&apos;ve never used before. OrbitX collapses that into one flow: sign in with X, get a
            wallet on every supported chain automatically, and launch on whichever one your community already
            trades on.
          </p>
          <p>
            Nothing here is a promise of price, liquidity, or return. A token launched through OrbitX is a token
            like any other on its underlying chain — see{" "}
            <Link href="/terms" className="underline">
              Terms
            </Link>{" "}
            for the specifics.
          </p>
        </Section>

        <Section n="02" title="Three chains, one desk">
          <p>
            <strong className="text-white">Solana</strong> — launches print directly on pump.fun&apos;s bonding curve via
            the official on-chain program. Graduation moves the token to PumpSwap. Every Solana token gets a full
            OrbitX page with a live chart, real buy/sell activity, and in-app trading routed through Jupiter across
            every Solana DEX.
          </p>
          <p>
            <strong className="text-white">Arc</strong> — a Chapter is a USDC-quoted bonding curve, live on Arc mainnet
            (chain 5042) the moment you create it. Buyers write the book; graduation seeds a deeper Uniswap v4 pool
            from the vault.
          </p>
          <p>
            <strong className="text-white">Robinhood Chain</strong> — launches are fully live and out of beta. They
            print on Pons v2, a spot curve that&apos;s tradable from block one. Volume feeds the curve, then
            graduates into a locked Uniswap v4 LP.
          </p>
        </Section>

        <Section n="03" title="The desk wallet">
          <p>
            You don&apos;t connect Phantom or MetaMask. Signing in with X gives you a desk wallet per chain, generated
            and held by OrbitX. Launches, trades, fee claims, and on-chain chat messages all sign server-side from
            that wallet — that&apos;s the entire mechanism that lets you do any of this from a phone browser without a
            wallet extension.
          </p>
          <p>
            That also means it&apos;s custodial: OrbitX holds the key, not just a session token. You can export any
            desk wallet&apos;s private key yourself from Wallet → Export keys at any time — it&apos;s your wallet, on real
            chains, and nothing stops you from moving to self-custody. See{" "}
            <Link href="/privacy" className="underline">
              Privacy
            </Link>{" "}
            for exactly what we store.
          </p>
        </Section>

        <Section n="04" title="Press Cards">
          <p>
            A Press Card is a real, transferable Metaplex Core NFT on Solana — not a database row pretending to be
            one. Every card is minted on creation to the creator&apos;s desk wallet, with on-chain metadata (name,
            image, rarity, edition, creator) served from its own endpoint.
          </p>
          <p>
            A card can stand alone, or pair to a token you&apos;ve launched — pairing is verified against who actually
            launched that token, so a card can only ever link to its own creator&apos;s token, never someone else&apos;s.
            Five pricing modes decide how a card&apos;s value behaves:
          </p>
          <dl className="grid gap-3 sm:grid-cols-2">
            {CARD_FLYWHEELS.map((mode) => (
              <div key={mode.id} className="rounded-2xl border border-white/10 p-4">
                <dt className="font-medium text-white">{mode.label}</dt>
                <dd className="mt-1 text-sm text-white/55">{mode.hint}</dd>
              </div>
            ))}
          </dl>
          <p>
            Buying a card is an offer, not an instant purchase — the current holder accepts or declines. Because
            both sides trade through OrbitX desk wallets, an accepted offer settles as one atomic transaction: the
            payment and the NFT transfer happen together, on-chain, or neither happens at all.
          </p>
        </Section>

        <Section n="05" title="Trading">
          <p>
            Every Solana token gets a real trade panel — buy or sell with SOL or USDC directly from your desk
            wallet, quoted and routed through Jupiter across every Solana DEX. The same panel powers a dedicated{" "}
            <Link href="/trade" className="underline">
              /trade
            </Link>{" "}
            page for trading any Solana token by pasting its mint. Arc Chapters trade on their own native USDC
            curve. Robinhood Chain trading currently happens on Pons&apos; own interface — in-app trading for that
            chain isn&apos;t built yet.
          </p>
        </Section>

        <Section n="06" title="On-chain chat">
          <p>
            Every token page has a live chat. Each message buys and burns a small amount of $ORBITX from the
            sender&apos;s desk wallet, executed as a real on-chain transaction — not a simulated cost. There&apos;s a
            visible running total and a daily spend cap enforced server-side, so this is never an unlimited or
            silent charge.
          </p>
        </Section>

        <Section n="07" title="$ORBITX">
          <p>
            $ORBITX is OrbitX&apos;s own token, live on Solana. A share of protocol fees route into buying and burning
            $ORBITX on a schedule — the same buy-and-burn mechanism individual users trigger themselves through
            chat is, at root, the same idea applied at the protocol level.
          </p>
          <p className="rounded-2xl border border-arc/25 bg-arc/[0.06] px-4 py-3 font-mono text-sm text-arc">
            CA: {OFFICIAL_TOKEN.mint}
          </p>
          <p className="text-sm text-white/45">
            Only trust this contract address from official OrbitX channels. Anyone can deploy a token with the same
            name or ticker.
          </p>
        </Section>

        <Section n="08" title="Risk, in plain terms">
          <p>
            Bonding curves can go to zero. Graduation is not a listing guarantee anywhere. Creator fees are swap
            fees, not dividends, and holder claims are a split of a pool the creator funds — not profit sharing.
            Desk wallets are custodial; if you want self-custody, export your key and move funds yourself. None of
            this is investment advice, and OrbitX is not a broker, exchange, or adviser. Full terms:{" "}
            <Link href="/terms" className="underline">
              /terms
            </Link>
            .
          </p>
        </Section>
      </div>
    </article>
  );
}
