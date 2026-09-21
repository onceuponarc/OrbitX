import type { NextConfig } from "next";

const bigintBufferStub = "./src/lib/solana/bigint-buffer-stub.cjs";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      "https://txrdfjypnuvlyseefclj.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      "",
  },
  // Do not externalize @solana/web3.js — Vercel cannot load its native bigint-buffer addon.
  serverExternalPackages: ["pino-pretty", "lokijs", "encoding"],
  turbopack: {
    resolveAlias: {
      "bigint-buffer": bigintBufferStub,
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "bigint-buffer": bigintBufferStub,
    };
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "abs.twimg.com" },
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "gateway.pinata.cloud" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
      { protocol: "https", hostname: "*.ipfs.w3s.link" },
    ],
  },
  async redirects() {
    return [
      { source: "/press", destination: "/launch", permanent: false },
      { source: "/desk", destination: "/", permanent: false },
      { source: "/claims", destination: "/ledger", permanent: false },
      { source: "/write", destination: "/launch", permanent: false },
      { source: "/bindings/link", destination: "/bindings", permanent: false },
      { source: "/orbitxlaunch", destination: "/", permanent: false },
      { source: "/orbitxlaunch/:path*", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
