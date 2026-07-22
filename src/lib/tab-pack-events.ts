import type { WebCard } from "@/lib/types";

export const CREATE_TAB_PACK_FROM_CARD_EVENT = "webcollect:create-tab-pack-from-card";

export function requestCreateTabPackFromCard(card: WebCard): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<WebCard>(CREATE_TAB_PACK_FROM_CARD_EVENT, { detail: card }));
}
