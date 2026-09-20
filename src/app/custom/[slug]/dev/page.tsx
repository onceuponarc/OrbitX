import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { loadLaunchBySlug } from "@/lib/custom-launch/persist";
import { CustomLaunchDevDesk } from "@/components/custom-launch/dev-desk";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return { title: `Dev desk · ${slug}` };
}

export default async function CustomLaunchDevPage({ params }: Props) {
  const { slug } = await params;
  const { user } = await getSessionUser();
  if (!user) redirect("/auth/login");
  const launch = await loadLaunchBySlug(slug);
  if (!launch) notFound();
  if (launch.author_user_id !== user.id) notFound();
  return <CustomLaunchDevDesk slug={slug} />;
}
