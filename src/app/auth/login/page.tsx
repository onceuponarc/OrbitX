import { Button } from "@/components/ui/button";
import { XMark } from "@/components/x-mark";
import Link from "next/link";
import { AgentCodeForm } from "@/components/auth/agent-code-form";

export const metadata = { title: "Sign in with X" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-6">
      <div className="pad-panel rounded-[1.6rem] p-7 sm:p-10">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">OrbitX</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-3 text-sm text-white/60">
          Identity is X. The desk wallet opens after you sign in — then launch and trade without an extension.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Button asChild className="h-12 w-full rounded-2xl text-base">
            <a href="/auth/start">
              <XMark className="size-3.5" />
              Continue with X
            </a>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/">Back to the pad</Link>
          </Button>
        </div>
        <AgentCodeForm />
        <p className="mt-6 text-center text-xs text-white/40">No email signup. No password.</p>
      </div>
    </div>
  );
}
