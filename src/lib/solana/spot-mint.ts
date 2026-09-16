import {
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  AuthorityType,
  AccountState,
  ExtensionType,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createInitializeTransferFeeConfigInstruction,
  createInitializeDefaultAccountStateInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  getMintLen,
  getAssociatedTokenAddressSync,
  MINT_SIZE,
} from "@solana/spl-token";
import { protocolKeypair } from "@/lib/solana/keys";
import { solanaConnection } from "@/lib/solana/connection";
import { resolveLaunchMint } from "@/lib/solana/vanity";

export type SpotProgram = "spl" | "token2022";
export type SpotMode = "direct" | "fair";

export async function buildSpotMintTx(input: {
  payer: string;
  name: string;
  symbol: string;
  program?: SpotProgram;
  mode?: SpotMode;
  taxBps?: number;
  vanity?: boolean;
}) {
  const payer = new PublicKey(input.payer);
  const program: SpotProgram = input.program === "spl" ? "spl" : "token2022";
  const mode: SpotMode = input.mode === "fair" ? "fair" : "direct";
  const programId = program === "spl" ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID;
  const decimals = 6;
  const supply = 1_000_000_000n * 10n ** BigInt(decimals);
  const taxBps = program === "token2022" ? Math.min(200, Math.max(0, Math.round(input.taxBps ?? 100))) : 0;
  const minted = await resolveLaunchMint(input.vanity !== false);
  const mint = minted.keypair.publicKey;
  const protocol = protocolKeypair().publicKey;
  const extensions = [];
  if (program === "token2022" && taxBps > 0) extensions.push(ExtensionType.TransferFeeConfig);
  if (program === "token2022" && mode === "fair") extensions.push(ExtensionType.DefaultAccountState);
  const mintLen = program === "spl" ? MINT_SIZE : getMintLen(extensions);
  const conn = solanaConnection();
  const lamports = await conn.getMinimumBalanceForRentExemption(mintLen);
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const creatorAta = getAssociatedTokenAddressSync(mint, payer, false, programId);
  const freezeAuthority = mode === "fair" ? payer : program === "token2022" ? protocol : null;

  const tx = new Transaction({ feePayer: payer, recentBlockhash: blockhash });
  tx.add(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mint,
      space: mintLen,
      lamports,
      programId,
    }),
  );
  if (program === "token2022" && taxBps > 0) {
    tx.add(
      createInitializeTransferFeeConfigInstruction(mint, payer, payer, taxBps, supply, TOKEN_2022_PROGRAM_ID),
    );
  }
  if (program === "token2022" && mode === "fair") {
    tx.add(createInitializeDefaultAccountStateInstruction(mint, AccountState.Frozen, TOKEN_2022_PROGRAM_ID));
  }
  tx.add(createInitializeMint2Instruction(mint, decimals, payer, freezeAuthority, programId));
  tx.add(createAssociatedTokenAccountInstruction(payer, creatorAta, payer, mint, programId));
  tx.add(createMintToInstruction(mint, creatorAta, payer, supply, [], programId));
  tx.add(createSetAuthorityInstruction(mint, payer, AuthorityType.MintTokens, null, [], programId));

  return {
    transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
    mint: mint.toBase58(),
    mintSecret: Buffer.from(minted.keypair.secretKey).toString("base64"),
    vanity: minted.vanity,
    program,
    mode,
    taxBps,
    bondingCurve: false,
    note:
      mode === "fair"
        ? "Fair window: accounts start frozen. Thaw after the anti-snipe window. No bonding curve."
        : "Direct: full supply is live. Seed a PumpSwap book to trade. No bonding curve.",
  };
}
