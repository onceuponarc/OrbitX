import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  AuthorityType,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  getAssociatedTokenAddressSync,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const MAX_TX_BYTES = 1232;

function metadataPda(mint) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID,
  )[0];
}

function borshString(value, maxBytes) {
  const sliced = Buffer.from(value, "utf8").subarray(0, maxBytes);
  const out = Buffer.alloc(4 + sliced.length);
  out.writeUInt32LE(sliced.length, 0);
  sliced.copy(out, 4);
  return out;
}

const payer = Keypair.generate();
const mint = Keypair.generate();
const curve = Keypair.generate();
const mintPk = mint.publicKey;
const metadata = metadataPda(mintPk);
const name = borshString("OrbitX Test Coin Name Here", 32);
const symbol = borshString("ONCEUPON", 10);
const uri = borshString(`https://www.orbitxtrade.world/api/token/${mintPk.toBase58()}/metadata`, 200);
const sellerFee = Buffer.alloc(2);
const creator = Buffer.concat([payer.publicKey.toBuffer(), Buffer.from([1, 100])]);
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
  Buffer.from([0]),
  Buffer.from([0]),
  Buffer.from([1]),
  Buffer.from([0]),
]);
const metadataIx = new TransactionInstruction({
  programId: TOKEN_METADATA_PROGRAM_ID,
  keys: [
    { pubkey: metadata, isSigner: false, isWritable: true },
    { pubkey: mintPk, isSigner: false, isWritable: false },
    { pubkey: payer.publicKey, isSigner: true, isWritable: false },
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: payer.publicKey, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data,
});
const ata = getAssociatedTokenAddressSync(mintPk, curve.publicKey, false, TOKEN_PROGRAM_ID);
const tx = new Transaction().add(
  ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
  ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
  SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mintPk,
    space: MINT_SIZE,
    lamports: 1_461_600,
    programId: TOKEN_PROGRAM_ID,
  }),
  createInitializeMint2Instruction(mintPk, 6, payer.publicKey, null, TOKEN_PROGRAM_ID),
  createAssociatedTokenAccountInstruction(payer.publicKey, ata, curve.publicKey, mintPk, TOKEN_PROGRAM_ID),
  createMintToInstruction(mintPk, ata, payer.publicKey, 1_000_000_000_000_000n, [], TOKEN_PROGRAM_ID),
  metadataIx,
  createSetAuthorityInstruction(mintPk, payer.publicKey, AuthorityType.MintTokens, null, [], TOKEN_PROGRAM_ID),
  SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: curve.publicKey, lamports: 8_000_000 }),
);
tx.feePayer = payer.publicKey;
tx.recentBlockhash = "EkSnNWid2cfEeRdygAWE5G2Vz8e6zUbg4Gdph9kJCkhs";
tx.partialSign(mint);
const raw = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
if (raw.length > MAX_TX_BYTES) {
  console.error(`Mint tx ${raw.length} bytes exceeds ${MAX_TX_BYTES}.`);
  process.exit(1);
}
console.log(`Mint sign-and-pay tx ${raw.length} bytes (limit ${MAX_TX_BYTES}).`);
