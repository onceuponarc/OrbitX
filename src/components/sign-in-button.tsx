"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { OrbitXer } from "@/lib/auth";
import { XMark } from "@/components/x-mark";
import Link from "next/link";

export function SignInButton({ profile, compact = false }: { profile: OrbitXer | null; compact?: boolean }) {
  if (profile) {
    const initial = profile.handle.slice(0, 1).toUpperCase();
    return (
      <Link
        href={`/you`}
        className="flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-1.5 py-1 transition-colors hover:border-gold/40"
      >
        <Avatar size="sm">
          {profile.portraitUrl ? <AvatarImage src={profile.portraitUrl} alt="" /> : null}
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <span className="hidden pr-1.5 text-sm text-white sm:inline">@{profile.handle}</span>
      </Link>
    );
  }

  if (compact) {
    return (
      <Button asChild size="sm" className="rounded-full px-3">
        <a href="/auth/login">Sign in</a>
      </Button>
    );
  }

  return (
    <Button asChild size="sm" className="rounded-full">
      <a href="/auth/login" className="gap-1.5">
        <XMark className="size-3.5" />
        Sign in with X
      </a>
    </Button>
  );
}

export function SignOutButton() {
  return (
    <Button variant="outline" asChild>
      <a href="/auth/logout">Sign out</a>
    </Button>
  );
}
