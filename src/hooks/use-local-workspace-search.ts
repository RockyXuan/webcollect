"use client";

import { useMemo } from "react";
import {
  mergeHybridCardResults,
  type HybridCardSearchResult,
} from "@/lib/hybrid-workspace-search";
import {
  limitSearchQuery,
  searchWorkspaceIndex,
  type WorkspaceSearchIndex,
  type WorkspaceSearchResults,
} from "@/lib/workspace-search";

export interface LocalWorkspaceSearchState {
  localResults: WorkspaceSearchResults;
  cards: HybridCardSearchResult[];
}

/** Synchronous, network-free search for the saved workspace and local cache. */
export function useLocalWorkspaceSearch(
  query: string,
  index: WorkspaceSearchIndex,
): LocalWorkspaceSearchState {
  const limitedQuery = limitSearchQuery(query);
  const localResults = useMemo(
    () => searchWorkspaceIndex(index, limitedQuery),
    [index, limitedQuery],
  );
  const cards = useMemo(() => mergeHybridCardResults({
    query: limitedQuery,
    index,
    localResults: localResults.cards,
    semanticResults: [],
  }), [index, limitedQuery, localResults.cards]);

  return { localResults, cards };
}
