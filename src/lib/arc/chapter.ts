import "server-only";

import { encodeFunctionData, formatUnits, parseEther, parseUnits, zeroHash } from "viem";
import { CHAPTER } from "@onceupon/config/chapter";
import { isPublicArc } from "@onceupon/config/arc";
import { curveAbi, erc20Abi, factoryAbi } from "@/lib/arc/abi";
import { publicArc, requireArcNetwork, traderWallet } from "@/lib/arc/client";
import { loadArcNetwork } from "@/lib/arc/env";
import { PUBLIC_SITE_URL } from "@onceupon/config/urls";
import { ensureArcDevnet } from "@/lib/arc/ensure";
import {
  appendLocalArcTrade,
  upsertLocalArcStory,
  type LocalArcStory,
} from "@/lib/arc/store";
import { listPersistedArcStories, loadArcStory, persistArcStory, persistArcTrade } from "@/lib/arc/persist";
import { arcTradeFee, collectArcTradeFee } from "@/lib/arc/orbitx-fee";
import { recordArcRevenueEvent } from "@/lib/arc/revenue";

const ANVIL_QUOTE = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707".toLowerCase();

function isAnvilChapter(story: { quoteAddress?: string | null; curveAddress?: string | null }) {
  const quote = (story.quoteAddress ?? "").toLowerCase();
  const curve = (story.curveAddress ?? "").toLowerCase();
  return quote === ANVIL_QUOTE || curve.startsWith("0x5fc8") || quote.startsWith("0xe7f1725e");
}

async function requireLiveCurve(story: { quoteAddress: `0x${string}`; curveAddress: `0x${string}`; tokenAddress: `0x${string}` }) {
  const net = requireArcNetwork();
  if (!isPublicArc(net.chainId) && !isAnvilChapter(story)) return;
  if (isPublicArc(net.chainId) && isAnvilChapter(story)) {
    throw new Error(
      "This Chapter was printed on local Anvil, not Arc. Launch a new Chapter on the live factory.",
    );
  }
  const pub = publicArc(net);
  const [curveCode, quoteCode] = await Promise.all([
    pub.getCode({ address: story.curveAddress }),
    pub.getCode({ address: story.quoteAddress }),
  ]);
  if (!curveCode || curveCode === "0x" || !quoteCode || quoteCode === "0x") {
    throw new Error(
      "This Chapter’s curve is not a contract on the current RPC.",
    );
  }
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

async function ensureAllowance(
  token: `0x${string}`,
  owner: `0x${string}`,
  spender: `0x${string}`,
  amount: bigint,
) {
  const net = requireArcNetwork();
  const pub = publicArc(net);
  const wallet = traderWallet(net);
  const current = await pub.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  });
  if (current >= amount) return;
  const hash = await wallet.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
  });
  await pub.waitForTransactionReceipt({ hash });
}

export async function arcStatus() {
  try {
    await ensureArcDevnet();
  } catch {
    /* status still reports the missing factory below */
  }
  const net = loadArcNetwork();
  if (!net) {
    return {
      ready: false as const,
      label: "Arc",
      error: "Factory is not deployed. Run pnpm arc:devnet.",
    };
  }
  const pub = publicArc(net);
  const wallet = traderWallet(net);
  const address = wallet.account.address;
  let gas = 0n;
  let usdc = 0n;
  const tokenBalance = 0n;
  try {
    gas = await pub.getBalance({ address });
    usdc = await pub.readContract({
      address: net.usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    });
  } catch (error) {
    return {
      ready: false as const,
      label: net.label,
      chainId: net.chainId,
      rpcUrl: net.rpcUrl,
      factory: net.factory,
      usdc: net.usdc,
      address,
      error: error instanceof Error ? error.message : "Arc RPC is down.",
    };
  }
  return {
    ready: true as const,
    label: net.label,
    chainId: net.chainId,
    rpcUrl: net.rpcUrl,
    explorer: net.explorer,
    factory: net.factory,
    usdc: net.usdc,
    nativeGas: net.nativeGas,
    address,
    gasEth: formatUnits(gas, 18),
    usdcUi: Number(formatUnits(usdc, 6)),
    tokenBalance: tokenBalance.toString(),
        note:
          net.nativeGas === "usdc"
            ? "Public Arc uses USDC for gas."
            : "Arc mainnet. USDC pays gas.",
  };
}

export async function dripFaucet(to?: `0x${string}`) {
  await ensureArcDevnet();
  const net = requireArcNetwork();
  const { deployerWallet } = await import("@/lib/arc/client");
  const pub = publicArc(net);
  const deployer = deployerWallet(net);
  const testnet = isPublicArc(net.chainId);
  const fallback = testnet
    ? ("0xAce02417493B6E28431E5AdbBAfEdc6D1007E7b7" as `0x${string}`)
    : traderWallet(net).account.address;
  const trader = to || fallback;
  const dripNative = testnet ? parseEther("0.25") : parseEther("25");
  const gas = await deployer.sendTransaction({
    to: trader,
    value: dripNative,
  });
  await pub.waitForTransactionReceipt({ hash: gas });
  if (testnet) {
    return {
      hash: gas,
      amountUi: 0.25,
      address: trader,
      gas,
      note: "Public Arc Testnet USDC is Circle’s. Get test USDC from faucet.circle.com — this drip only covers gas.",
    };
  }
  const amount = parseUnits("500", 6);
  const hash = await deployer.writeContract({
    address: net.usdc,
    abi: erc20Abi,
    functionName: "mint",
    args: [trader, amount],
  });
  await pub.waitForTransactionReceipt({ hash });
  return { hash, amountUi: 500, address: trader, gas };
}

export function prepareUserCreate(input: {
  title: string;
  ticker: string;
  blurb: string;
  engine: "author" | "onceuponers";
  authorBps: number;
  graduateUi: number;
  creator: `0x${string}`;
  coverUrl?: string | null;
}) {
  const net = loadArcNetwork();
  if (!net?.factory) throw new Error("Set ARC_FACTORY after the factory is deployed.");
  const ticker = input.ticker.trim().toUpperCase().slice(0, 12);
  const title = input.title.trim();
  const graduate = parseUnits(String(input.graduateUi || CHAPTER.graduateQuoteUi), 6);
  const authorBps = Math.min(Math.max(50, input.authorBps), 980);
  const data = encodeFunctionData({
    abi: factoryAbi,
    functionName: "createStory",
    args: [
      {
        name: title.slice(0, 32),
        symbol: ticker.slice(0, 10),
        uri: input.coverUrl || `${PUBLIC_SITE_URL}/onceupon-cover.svg`,
        quote: net.usdc,
        engine: input.engine === "onceuponers" ? 1 : 0,
        authorBps,
        protocolBps: 0,
        pieceBps: 0,
        graduateQuoteTarget: graduate,
        feeRecipient: input.creator,
        seedQuote: 0n,
        minBaseOut: 0n,
      },
    ],
  });
  return {
    to: net.factory,
    data,
    chainId: net.chainId,
    feeRecipient: input.creator,
    authorBps,
    protocolBps: 0,
    ticker,
    title,
  };
}

export async function launchOnArc(input: {
  title: string;
  ticker: string;
  blurb: string;
  engine: "author" | "onceuponers";
  authorBps: number;
  graduateUi: number;
  handle: string | null;
  coverUrl?: string | null;
  userId?: string | null;
  creator?: `0x${string}`;
}) {
  if (input.creator) {
    return prepareUserCreate({
      title: input.title,
      ticker: input.ticker,
      blurb: input.blurb,
      engine: input.engine,
      authorBps: input.authorBps,
      graduateUi: input.graduateUi,
      creator: input.creator,
      coverUrl: input.coverUrl,
    });
  }
  await ensureArcDevnet();
  const net = requireArcNetwork();
  const pub = publicArc(net);
  const wallet = traderWallet(net);
  const ticker = input.ticker.trim().toUpperCase().slice(0, 12);
  const title = input.title.trim();
  const graduate = parseUnits(String(input.graduateUi || CHAPTER.graduateQuoteUi), 6);
  const authorBps = Math.min(Math.max(0, input.authorBps), input.engine === "author" ? 300 : 100);

  const { request, result } = await pub.simulateContract({
    account: wallet.account,
    address: net.factory,
    abi: factoryAbi,
    functionName: "createStory",
    args: [
      {
        name: title.slice(0, 32),
        symbol: ticker.slice(0, 10),
        uri: input.coverUrl || `${PUBLIC_SITE_URL}/onceupon-cover.svg`,
        quote: net.usdc,
        engine: input.engine === "onceuponers" ? 1 : 0,
        authorBps,
        protocolBps: 20,
        pieceBps: input.engine === "onceuponers" ? 0 : 0,
        graduateQuoteTarget: graduate,
        feeRecipient: wallet.account.address,
        seedQuote: 0n,
        minBaseOut: 0n,
      },
    ],
  });
  const hash = await wallet.writeContract(request);
  await pub.waitForTransactionReceipt({ hash });
  const [storyId, curveAddr, tokenAddr] = result;
  const snap = await pub.readContract({
    address: curveAddr,
    abi: curveAbi,
    functionName: "snapshot",
  });
  const slug = `${slugify(title) || slugify(ticker) || "chapter"}-${Math.random().toString(36).slice(2, 6)}`;
  const story: LocalArcStory = {
    id: storyId,
    slug,
    title,
    ticker,
    blurb: input.blurb.trim(),
    engine: input.engine,
    status: snap[0] ? "graduated" : "live",
    chain: "arc",
    venue: "spl",
    pairLabel: "USDC",
    authorBps,
    protocolBps: 20,
    handle: input.handle,
    coverUrl: input.coverUrl ?? null,
    createdAt: new Date().toISOString(),
    tokenAddress: tokenAddr,
    curveAddress: curveAddr,
    quoteAddress: net.usdc,
    storyId,
    createdTx: hash,
    mintDecimals: 18,
    quoteDecimals: 6,
    supply: (1_000_000_000n * 10n ** 18n).toString(),
    graduationQuoteRaw: graduate.toString(),
    curveQuoteRaw: snap[3].toString(),
    curveTokenRaw: snap[4].toString(),
    virtualQuoteRaw: snap[1].toString(),
    virtualBaseRaw: snap[2].toString(),
    trades: [],
  };
  upsertLocalArcStory(story);
  await persistArcStory(story, { userId: input.userId ?? null, authorWallet: wallet.account.address });
  return { slug, mint: tokenAddr, curve: curveAddr, tx: hash, story };
}

export async function quoteArcTrade(slug: string, side: "buy" | "sell", amountUi: number) {
  const story = await loadArcStory(slug);
  if (!story) throw new Error("Unknown Arc Chapter.");
  await ensureArcDevnet();
  const net = requireArcNetwork();
  const pub = publicArc(net);
  if (side === "buy") {
    const quoteIn = parseUnits(String(amountUi), 6);
    const [baseOut, fee] = await pub.readContract({
      address: story.curveAddress,
      abi: curveAbi,
      functionName: "quoteBuy",
      args: [zeroHash, quoteIn],
    });
    return {
      side,
      quoteIn: quoteIn.toString(),
      baseOut: baseOut.toString(),
      fee: fee.toString(),
      baseOutUi: Number(formatUnits(baseOut, 18)),
      feeUi: Number(formatUnits(fee, 6)),
    };
  }
  const baseIn = parseUnits(String(amountUi), 18);
  const [quoteOut, fee] = await pub.readContract({
    address: story.curveAddress,
    abi: curveAbi,
    functionName: "quoteSell",
    args: [zeroHash, baseIn],
  });
  return {
    side,
    baseIn: baseIn.toString(),
    quoteOut: quoteOut.toString(),
    fee: fee.toString(),
    quoteOutUi: Number(formatUnits(quoteOut, 6)),
    feeUi: Number(formatUnits(fee, 6)),
  };
}

export async function tradeOnArc(slug: string, side: "buy" | "sell", amountUi: number) {
  const story = await loadArcStory(slug);
  if (!story) throw new Error("Unknown Arc Chapter.");
  await ensureArcDevnet();
  const net = requireArcNetwork();
  await requireLiveCurve(story);
  const pub = publicArc(net);
  const wallet = traderWallet(net);
  const owner = wallet.account.address;
  let hash: `0x${string}`;
  let amountIn: bigint;
  let amountOut: bigint;
  let quoteUi: number;
  let tokensUi: number;

  let fee = arcTradeFee({
    side,
    grossInRaw: side === "buy" ? parseUnits(String(amountUi), 6) : 0n,
    minQuoteOutRaw: 0n,
  });

  if (side === "buy") {
    const grossIn = parseUnits(String(amountUi), 6);
    // The user enters gross USDC. Only net USDC reaches the curve; the fee is
    // collected from the same wallet after the confirmed trade.
    amountIn = fee.netInRaw;
    await ensureAllowance(story.quoteAddress, owner, story.curveAddress, amountIn);
    const quoted = await pub.readContract({
      address: story.curveAddress,
      abi: curveAbi,
      functionName: "quoteBuy",
      args: [zeroHash, amountIn],
    });
    amountOut = quoted[0];
    const minOut = (amountOut * 95n) / 100n;
    hash = await wallet.writeContract({
      address: story.curveAddress,
      abi: curveAbi,
      functionName: "buy",
      args: [amountIn, minOut],
    });
    quoteUi = Number(formatUnits(grossIn, 6));
    tokensUi = Number(formatUnits(amountOut, 18));
  } else {
    amountIn = parseUnits(String(amountUi), 18);
    await ensureAllowance(story.tokenAddress, owner, story.curveAddress, amountIn);
    const quoted = await pub.readContract({
      address: story.curveAddress,
      abi: curveAbi,
      functionName: "quoteSell",
      args: [zeroHash, amountIn],
    });
    amountOut = quoted[0];
    const minOut = (amountOut * 95n) / 100n;
    hash = await wallet.writeContract({
      address: story.curveAddress,
      abi: curveAbi,
      functionName: "sell",
      args: [amountIn, minOut],
    });
    quoteUi = Number(formatUnits(amountOut, 6));
    tokensUi = amountUi;
  }

  // The curve trade is confirmed before OrbitX collects its Arc USDC fee.
  // Arc's current curve API cannot bundle the revenue transfer atomically;
  // this ordering makes it impossible to charge a fee for a reverted trade.
  const tradeReceipt = await pub.waitForTransactionReceipt({ hash });
  if (tradeReceipt.status !== "success") throw new Error("Arc trade reverted.");
  fee = side === "buy"
    ? fee
    : arcTradeFee({
        side,
        grossInRaw: 0n,
        minQuoteOutRaw: (amountOut * 95n) / 100n,
      });
  const collected = await collectArcTradeFee({ net, feeRaw: fee.feeRaw, tradeTxHash: hash });
  await recordArcRevenueEvent({
    kind: "trade",
    feeTxHash: collected.feeTxHash,
    tradeTxHash: hash,
    payer: owner,
    feeMint: net.usdc,
    feeAmountRaw: fee.feeRaw,
    feeBps: fee.feeBps,
    side,
    tokenAddress: story.tokenAddress,
    verified: collected.verified,
    collectionError: collected.error,
  });
  const snap = await pub.readContract({
    address: story.curveAddress,
    abi: curveAbi,
    functionName: "snapshot",
  });
  const priceUsd = tokensUi > 0 ? quoteUi / tokensUi : 0;
  const trade = {
    txHash: hash,
    side,
    trader: owner,
    amountIn: amountIn.toString(),
    amountOut: amountOut.toString(),
    priceUsd,
    tradedAt: new Date().toISOString(),
  };
  const patch = {
    status: snap[0] ? ("graduated" as const) : ("live" as const),
    curveQuoteRaw: snap[3].toString(),
    curveTokenRaw: snap[4].toString(),
    virtualQuoteRaw: snap[1].toString(),
    virtualBaseRaw: snap[2].toString(),
  };
  const updated = appendLocalArcTrade(slug, trade, patch);
  await persistArcTrade(slug, trade, patch);
  return { hash, amountOut: amountOut.toString(), quoteUi, tokensUi, priceUsd, story: updated ?? (await loadArcStory(slug)) };
}

export async function arcSnapshot(slug: string) {
  const story = await loadArcStory(slug);
  if (!story) return null;
  try {
    await ensureArcDevnet();
  } catch {
    /* snapshot still returns the story without on-chain fields */
  }
  const net = loadArcNetwork();
  if (!net) return { story, onchain: null };
  if (isPublicArc(net.chainId) && isAnvilChapter(story)) {
    return { story, onchain: null, offline: "anvil-only" as const };
  }
  const pub = publicArc(net);
  const snap = await pub.readContract({
    address: story.curveAddress,
    abi: curveAbi,
    functionName: "snapshot",
  });
  const wallet = traderWallet(net);
  const tokenBal = await pub.readContract({
    address: story.tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [wallet.account.address],
  });
  const usdcBal = await pub.readContract({
    address: story.quoteAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [wallet.account.address],
  });
  const realQuote = Number(formatUnits(snap[3], 6));
  const target = Number(formatUnits(snap[6], 6));
  const vq = Number(formatUnits(snap[1], 6));
  const vb = Number(formatUnits(snap[2], 18));
  return {
    story,
    onchain: {
      graduated: snap[0],
      realQuote,
      target,
      progressBps: target > 0 ? Math.min(10_000, Math.round((realQuote / target) * 10_000)) : 0,
      spot: vb > 0 ? vq / vb : 0,
      tokenUi: Number(formatUnits(tokenBal, 18)),
      usdcUi: Number(formatUnits(usdcBal, 6)),
    },
  };
}

export async function allArcStories() {
  const stories = await listPersistedArcStories();
  const net = loadArcNetwork();
  if (!net || !isPublicArc(net.chainId)) return stories;
  return stories.filter((story) => !isAnvilChapter(story));
}
