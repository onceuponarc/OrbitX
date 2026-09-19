import { getSessionUser } from "@/lib/auth";
import { loadProfileDesk } from "@/lib/profile-desk";
import { ProfileDeskView } from "@/components/shelf/profile-desk";
import { Button } from "@/components/ui/button";
import { XMark } from "@/components/x-mark";

export const dynamic = "force-dynamic";
export const metadata = { title: "You" };

export default async function YouPage() {
  const { profile } = await getSessionUser();
  if (!profile) {
    return (
      <div className="pad-panel mx-auto max-w-md space-y-4 rounded-[1.4rem] p-8 text-center">
        <h1 className="text-2xl font-semibold">Your profile</h1>
        <p className="text-sm text-white/55">Sign in with X to see launches, fees, holdings, and fills.</p>
        <Button asChild>
          <a href="/auth/login">
            <XMark className="size-3.5" />
            Sign in with X
          </a>
        </Button>
      </div>
    );
  }

  let desk = null;
  try {
    desk = await loadProfileDesk(profile.handle, profile.id);
  } catch (error) {
    console.error("You profile failed", error);
  }

  if (!desk) {
    return (
      <div className="pad-panel mx-auto max-w-md rounded-[1.4rem] p-8 text-center">
        <h1 className="text-2xl font-semibold">@{profile.handle}</h1>
        <p className="mt-2 text-sm text-white/55">Profile did not load. Reload after sign-in settles.</p>
      </div>
    );
  }

  return <ProfileDeskView desk={desk} isSelf />;
}
