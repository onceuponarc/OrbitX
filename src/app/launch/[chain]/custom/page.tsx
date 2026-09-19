import { CustomLaunchWizard } from "@/components/custom-launch/wizard";
import { findChain, isPrintableChain } from "@onceupon/config/solana";
import { redirect } from "next/navigation";

type Props = { params: Promise<{ chain: string }> };

export async function generateMetadata({ params }: Props) {
  const { chain } = await params;
  const card = findChain(chain);
  return { title: card ? `Custom Launch on ${card.title}` : "Custom Launch" };
}

export default async function CustomLaunchPage({ params }: Props) {
  const { chain } = await params;
  if (!isPrintableChain(chain)) redirect("/launch");
  return <CustomLaunchWizard chain={chain} />;
}
