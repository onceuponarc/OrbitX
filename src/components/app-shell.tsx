import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PadBackground } from "@/components/pad/pad-background";
import { PadSidebar } from "@/components/pad/pad-sidebar";
import { TabBar } from "@/components/pad/tab-bar";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { Providers } from "@/components/providers";
import { PwaRegister } from "@/components/pwa-register";

export async function AppShell({ children }: { children: React.ReactNode }) {
  let profile = null as Awaited<ReturnType<typeof getSessionUser>>["profile"];
  let onlineCount = 0;
  try {
    const session = await getSessionUser();
    profile = session.profile;
    const supabase = await createClient();
    const { count } = await supabase.from("users").select("id", { count: "exact", head: true });
    onlineCount = count ?? 0;
  } catch (error) {
    console.error("AppShell failed", error);
  }

  return (
    <Providers>
      <div className="pad-app relative flex min-h-full flex-col text-parchment lg:flex-row">
        <PadBackground />
        <PadSidebar onlineCount={onlineCount} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <SiteHeader profile={profile} />
          <PwaRegister />
          <main className="pad-main mx-auto flex w-full max-w-6xl flex-1 flex-col lg:max-w-none">{children}</main>
          <SiteFooter />
        </div>
        <TabBar />
      </div>
    </Providers>
  );
}
