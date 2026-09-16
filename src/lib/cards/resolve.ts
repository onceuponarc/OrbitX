import { listCards, getCard, cardsForStory } from "@/lib/cards/store";
import { viewCard } from "@/lib/cards/math";
import type { CardView, PressCard } from "@/lib/cards/types";
import { loadPadMarket } from "@/lib/market";

const HIDDEN_TEST_CARD_SLUGS = new Set([
  "elon-musk-zrgf",
  "paid-s9ty",
  "trollpepe-zn4y",
  "test-mh7a",
  "blknoiz0-pymo",
]);

function isHiddenTestCard(slug: string) {
  return HIDDEN_TEST_CARD_SLUGS.has(slug.toLowerCase());
}

async function mcapMap() {
  try {
    const { launches } = await loadPadMarket();
    return new Map(launches.map((row) => [row.slug, row.mcapUi]));
  } catch {
    return new Map<string, number>();
  }
}

export async function viewAllCards(): Promise<CardView[]> {
  const mcaps = await mcapMap();
  const rows = await listCards();
  return rows
    .filter((card) => card.visibility !== "hidden" && !isHiddenTestCard(card.slug))
    .map((card) => viewCard(card, card.storySlug ? mcaps.get(card.storySlug) : null));
}

export async function viewOneCard(slug: string): Promise<CardView | null> {
  const card = await getCard(slug);
  if (!card || card.visibility === "hidden" || isHiddenTestCard(card.slug)) return null;
  const mcaps = await mcapMap();
  return viewCard(card, card.storySlug ? mcaps.get(card.storySlug) : null);
}

export async function viewCardsForStory(storySlug: string): Promise<CardView[]> {
  const mcaps = await mcapMap();
  const rows = await cardsForStory(storySlug);
  return rows
    .filter((card) => card.visibility !== "hidden" && !isHiddenTestCard(card.slug))
    .map((card) => viewCard(card, mcaps.get(storySlug) ?? card.startMcapUi));
}

export function previewCard(card: PressCard, mcap?: number) {
  return viewCard(card, mcap);
}
