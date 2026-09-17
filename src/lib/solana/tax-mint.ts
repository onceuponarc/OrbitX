import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  createInitializeTransferFeeConfigInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  getMintLen,
  ExtensionType,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { protocolKeypair } from "@/lib/solana/keys";
import { solanaConnection } from "@/lib/solana/connection";
import { VANITY_SUFFIX } from "@/lib/solana/vanity";
import { generateVanityMint } from "@/lib/solana/vanity-mine";

export const DEFAULT_TAX_BPS = 100;
export const MAX_TAX_BPS = 200;

export async function buildTaxMintTx(input: {
  payer: string;
  name: string;
  symbol: string;
  taxBps?: number;
  supplyUi?: number;
  vanity?: boolean;
}) {
  const payer = new PublicKey(input.payer);
  const taxBps = Math.min(MAX_TAX_BPS, Math.max(25, Math.round(input.taxBps ?? DEFAULT_TAX_BPS)));
  const decimals = 6;
  const supply = BigInt(Math.max(1, Math.floor(input.supplyUi ?? 1_000_000_000))) * 10n ** BigInt(decimals);
  const minted = input.vanity === false ? { keypair: Keypair.generate(), vanity: false, tries: 1 } : await generateVanityMint(VANITY_SUFFIX);
  const mint = minted.keypair.publicKey;
  const protocol = protocolKeypair().publicKey;
  const extensions = [ExtensionType.TransferFeeConfig];
  const mintLen = getMintLen(extensions);
  const conn = solanaConnection();
  const lamports = await conn.getMinimumBalanceForRentExemption(mintLen);
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const maxFee = supply;
  const creatorAta = getAssociatedTokenAddressSync(mint, payer, false, TOKEN_2022_PROGRAM_ID);

  const tx = new Transaction({ feePayer: payer, recentBlockhash: blockhash });
  tx.add(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mint,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeTransferFeeConfigInstruction(
      mint,
      payer,
      payer,
      taxBps,
      maxFee,
      TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeMint2Instruction(mint, decimals, payer, protocol, TOKEN_2022_PROGRAM_ID),
    createAssociatedTokenAccountInstruction(payer, creatorAta, payer, mint, TOKEN_2022_PROGRAM_ID),
    createMintToInstruction(mint, creatorAta, payer, supply, [], TOKEN_2022_PROGRAM_ID),
    createSetAuthorityInstruction(mint, payer, AuthorityType.MintTokens, null, [], TOKEN_2022_PROGRAM_ID),
  );

  return {
    transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
    mint: mint.toBase58(),
    mintSecret: Buffer.from(minted.keypair.secretKey).toString("base64"),
    vanity: minted.vanity,
    taxBps,
    program: TOKEN_2022_PROGRAM_ID.toBase58(),
    withdrawAuthority: protocol.toBase58(),
    name: input.name,
    symbol: input.symbol,
  };
}
