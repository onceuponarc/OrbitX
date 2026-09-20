import { PublicKey, SystemProgram, SYSVAR_INSTRUCTIONS_PUBKEY, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { TOKEN_METADATA_PROGRAM } from "@onceupon/config/launchpad";

export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(TOKEN_METADATA_PROGRAM);

/** Metaplex `Create` / CreateV1. Token-2022 mints must use this, not CreateMetadataAccountV3. */
export const CREATE_METADATA_V1_DISCRIMINATOR = 42;
export const TOKEN_STANDARD_FUNGIBLE = 2;

export function metadataPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID,
  )[0];
}

function borshString(value: string, maxBytes: number) {
  const sliced = Buffer.from(value, "utf8").subarray(0, maxBytes);
  const out = Buffer.alloc(4 + sliced.length);
  out.writeUInt32LE(sliced.length, 0);
  sliced.copy(out, 4);
  return out;
}

function optionNone() {
  return Buffer.from([0]);
}

/** Metaplex Token Metadata `CreateMetadataAccountV3` (instruction 33). SPL classic only. */
export function createMetadataV3Instruction(opts: {
  mint: PublicKey;
  mintAuthority: PublicKey;
  payer: PublicKey;
  updateAuthority: PublicKey;
  name: string;
  symbol: string;
  uri: string;
}): TransactionInstruction {
  const metadata = metadataPda(opts.mint);
  const name = borshString(opts.name.trim() || "OrbitX", 32);
  const symbol = borshString(opts.symbol.trim().toUpperCase() || "ORBX", 10);
  const uri = borshString(opts.uri, 200);
  const sellerFee = Buffer.alloc(2);
  sellerFee.writeUInt16LE(0, 0);
  const creator = Buffer.concat([opts.payer.toBuffer(), Buffer.from([1, 100])]);
  const creatorsSome = Buffer.alloc(1 + 4 + creator.length);
  creatorsSome[0] = 1;
  creatorsSome.writeUInt32LE(1, 1);
  creator.copy(creatorsSome, 5);
  const data = Buffer.concat([
    Buffer.from([33]),
    name,
    symbol,
    uri,
    sellerFee,
    creatorsSome,
    Buffer.from([0]), // collection None
    Buffer.from([0]), // uses None
    Buffer.from([1]), // isMutable
    Buffer.from([0]), // collectionDetails None
  ]);
  return new TransactionInstruction({
    programId: TOKEN_METADATA_PROGRAM_ID,
    keys: [
      { pubkey: metadata, isSigner: false, isWritable: true },
      { pubkey: opts.mint, isSigner: false, isWritable: false },
      { pubkey: opts.mintAuthority, isSigner: true, isWritable: false },
      { pubkey: opts.payer, isSigner: true, isWritable: true },
      { pubkey: opts.updateAuthority, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Metaplex Token Metadata `Create` (instruction 42 / CreateV1) for a fungible mint.
 * Required for Token-2022: CreateMetadataAccountV3 treats oversized Token-2022 mints as
 * programmable NFTs and reverts with 0x99 ("Instruction not supported for ProgrammableNonFungible assets").
 */
export function createFungibleMetadataInstruction(opts: {
  mint: PublicKey;
  mintAuthority: PublicKey;
  payer: PublicKey;
  updateAuthority: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  tokenProgram?: PublicKey;
}): TransactionInstruction {
  const tokenProgram = opts.tokenProgram ?? TOKEN_PROGRAM_ID;
  const metadata = metadataPda(opts.mint);
  const name = borshString(opts.name.trim() || "OrbitX", 32);
  const symbol = borshString(opts.symbol.trim().toUpperCase() || "ORBX", 10);
  const uri = borshString(opts.uri, 200);
  const sellerFee = Buffer.alloc(2);
  sellerFee.writeUInt16LE(0, 0);
  const data = Buffer.concat([
    Buffer.from([CREATE_METADATA_V1_DISCRIMINATOR]),
    Buffer.from([0]), // CreateArgs::V1
    name,
    symbol,
    uri,
    sellerFee,
    optionNone(), // creators
    Buffer.from([0]), // primarySaleHappened
    Buffer.from([1]), // isMutable
    Buffer.from([TOKEN_STANDARD_FUNGIBLE]),
    optionNone(), // collection
    optionNone(), // uses
    optionNone(), // collectionDetails
    optionNone(), // ruleSet
    optionNone(), // decimals — mint already initialized in this tx
    optionNone(), // printSupply
  ]);
  return new TransactionInstruction({
    programId: TOKEN_METADATA_PROGRAM_ID,
    keys: [
      { pubkey: metadata, isSigner: false, isWritable: true },
      // Optional master edition: program id means "none" for fungible CreateV1.
      { pubkey: TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: opts.mint, isSigner: false, isWritable: true },
      { pubkey: opts.mintAuthority, isSigner: true, isWritable: false },
      { pubkey: opts.payer, isSigner: true, isWritable: true },
      { pubkey: opts.updateAuthority, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: tokenProgram, isSigner: false, isWritable: false },
    ],
    data,
  });
}
