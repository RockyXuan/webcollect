import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/auth-store";
import type { ExtensionKnowledgeCoordinatorResult } from "@/lib/extension-knowledge-coordinator";
import type { KnowledgeConsentRecord } from "@/lib/knowledge-index";
import type { WebCard } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  getKnowledgeBuildState: vi.fn(),
  getKnowledgeConsent: vi.fn(),
  invalidateSemanticSearchSessionCache: vi.fn(),
  listKnowledgeCacheEntries: vi.fn(),
  reconcileExtensionKnowledge: vi.fn(),
  saveKnowledgeConsent: vi.fn(),
}));

vi.mock("@/hooks/use-hybrid-workspace-search", () => ({
  invalidateSemanticSearchSessionCache: mocks.invalidateSemanticSearchSessionCache,
}));

vi.mock("@/lib/extension-knowledge-coordinator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/extension-knowledge-coordinator")>();
  return { ...actual, reconcileExtensionKnowledge: mocks.reconcileExtensionKnowledge };
});

vi.mock("@/lib/knowledge-index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/knowledge-index")>();
  return {
    ...actual,
    getKnowledgeBuildState: mocks.getKnowledgeBuildState,
    getKnowledgeConsent: mocks.getKnowledgeConsent,
    listKnowledgeCacheEntries: mocks.listKnowledgeCacheEntries,
    saveKnowledgeConsent: mocks.saveKnowledgeConsent,
  };
});

vi.mock("@/lib/platform", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/platform")>();
  return { ...actual, isChromeExtension: () => true };
});

import { useKnowledgeBuild } from "@/hooks/use-knowledge-build";
import { useAuthStore } from "@/lib/auth-store";
import { useAppStore } from "@/lib/store";

const USER_A = "123e4567-e89b-42d3-a456-426614174001";
const USER_B = "123e4567-e89b-42d3-a456-426614174002";
const CARD_ID = "123e4567-e89b-42d3-a456-426614174011";

function user(id: string): AuthUser {
  return {
    id,
    email: `${id}@example.com`,
    displayName: id,
    avatarUrl: "",
  };
}

function card(): WebCard {
  return {
    id: CARD_ID,
    title: "GitHub",
    url: "https://github.com",
    shortDesc: "代码托管",
    fullDesc: "",
    note: "",
    abbreviation: "GH",
    imageUrl: "",
    categoryId: "cat-tools",
    order: 0,
    createdAt: 1,
    updatedAt: 1,
  };
}

function consent(consentedAt = 1): KnowledgeConsentRecord {
  return { version: 1, consentedAt };
}

function outcome(
  status: ExtensionKnowledgeCoordinatorResult["status"],
): ExtensionKnowledgeCoordinatorResult {
  return { status, indexedCount: 0, deletedCount: 0 };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function setSignedInUser(authUser: AuthUser, overrides: { isLoading?: boolean; syncStatus?: "idle" | "queued" | "syncing" | "success" | "error" } = {}): void {
  useAuthStore.setState({
    user: authUser,
    isLoggedIn: true,
    isLoading: overrides.isLoading ?? false,
    syncStatus: overrides.syncStatus ?? "success",
  });
}

function setWorkspaceReady(ready: boolean): void {
  useAppStore.setState({
    cards: [card()],
    categories: [],
    sections: [],
    isLoading: !ready,
    initialized: ready,
  });
}

async function flushImmediateEffects(): Promise<void> {
  // Consent hydration schedules the zero-delay baseline from a follow-up
  // effect. Drain only the current-tick work; the 2s incremental debounce must
  // remain pending so timing assertions below stay meaningful.
  for (let pass = 0; pass < 3; pass += 1) {
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
  }
}

describe("extension knowledge build hook integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.getKnowledgeBuildState.mockReset();
    mocks.getKnowledgeConsent.mockReset();
    mocks.invalidateSemanticSearchSessionCache.mockReset();
    mocks.listKnowledgeCacheEntries.mockReset();
    mocks.reconcileExtensionKnowledge.mockReset();
    mocks.saveKnowledgeConsent.mockReset();
    mocks.getKnowledgeBuildState.mockResolvedValue(null);
    mocks.getKnowledgeConsent.mockResolvedValue(null);
    mocks.listKnowledgeCacheEntries.mockResolvedValue([]);
    mocks.reconcileExtensionKnowledge.mockResolvedValue(outcome("idle"));
    mocks.saveKnowledgeConsent.mockResolvedValue(undefined);
    setSignedInUser(user(USER_A));
    setWorkspaceReady(true);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    useAuthStore.setState(useAuthStore.getInitialState(), true);
    useAppStore.setState(useAppStore.getInitialState(), true);
    vi.clearAllMocks();
  });

  it("does not reconcile before consent or while the account workspace is not ready", async () => {
    const first = renderHook(() => useKnowledgeBuild());
    await flushImmediateEffects();
    expect(first.result.current.consentReady).toBe(true);
    expect(first.result.current.consented).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    expect(mocks.reconcileExtensionKnowledge).not.toHaveBeenCalled();
    first.unmount();

    mocks.getKnowledgeConsent.mockResolvedValue(consent());
    setWorkspaceReady(false);
    const second = renderHook(() => useKnowledgeBuild());
    await flushImmediateEffects();
    expect(second.result.current.consented).toBe(true);
    expect(second.result.current.incrementalStatus).toBe("waiting-workspace");
    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    expect(mocks.reconcileExtensionKnowledge).not.toHaveBeenCalled();
    second.unmount();
  });

  it("runs the first consent baseline immediately and debounces later incremental changes", async () => {
    mocks.getKnowledgeConsent.mockResolvedValue(consent());
    mocks.reconcileExtensionKnowledge.mockResolvedValue(outcome("baseline-created"));
    const { result, unmount } = renderHook(() => useKnowledgeBuild());
    await flushImmediateEffects();

    expect(result.current.incrementalSupported).toBe(true);
    expect(result.current.buildSupported).toBe(false);
    expect(mocks.reconcileExtensionKnowledge).toHaveBeenCalledTimes(1);
    const baselineRequest = mocks.reconcileExtensionKnowledge.mock.calls[0][0];
    expect(baselineRequest.userId).toBe(USER_A);
    expect(baselineRequest.baselineCutoffAt).toBe(1);
    expect(baselineRequest.signal).toBeInstanceOf(AbortSignal);
    expect(baselineRequest.signal.aborted).toBe(false);
    expect(baselineRequest.isCurrent()).toBe(true);
    expect(baselineRequest.getCurrentUserId()).toBe(USER_A);
    expect(result.current.incrementalStatus).toBe("idle");

    act(() => {
      useAppStore.setState({
        cards: [{ ...card(), title: "GitHub updated", updatedAt: 2 }],
      });
    });
    await act(async () => vi.advanceTimersByTimeAsync(1_999));
    expect(mocks.reconcileExtensionKnowledge).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    await flushImmediateEffects();

    expect(mocks.reconcileExtensionKnowledge).toHaveBeenCalledTimes(2);
    expect(mocks.reconcileExtensionKnowledge.mock.calls[1][0].baselineCutoffAt).toBe(1);
    expect(result.current.incrementalStatus).toBe("idle");
    unmount();
  });

  it("aborts an old user's run and starts the switched account baseline immediately", async () => {
    const userARequest = deferred<ExtensionKnowledgeCoordinatorResult>();
    const userBRequest = deferred<ExtensionKnowledgeCoordinatorResult>();
    mocks.getKnowledgeConsent.mockImplementation((scopeId: string) => (
      Promise.resolve(consent(scopeId === USER_A ? 101 : 202))
    ));
    mocks.reconcileExtensionKnowledge.mockImplementation((request: { userId: string }) => (
      request.userId === USER_A ? userARequest.promise : userBRequest.promise
    ));
    const { result, unmount } = renderHook(() => useKnowledgeBuild());
    await flushImmediateEffects();
    const oldRequest = mocks.reconcileExtensionKnowledge.mock.calls[0][0];
    expect(oldRequest.baselineCutoffAt).toBe(101);
    expect(result.current.incrementalStatus).toBe("reconciling");

    act(() => setSignedInUser(user(USER_B)));
    await flushImmediateEffects();
    expect(oldRequest.signal.aborted).toBe(true);
    expect(oldRequest.isCurrent()).toBe(false);
    expect(mocks.reconcileExtensionKnowledge.mock.calls.map((call) => call[0].userId)).toEqual([USER_A, USER_B]);
    const switchedRequest = mocks.reconcileExtensionKnowledge.mock.calls[1][0];
    expect(switchedRequest.baselineCutoffAt).toBe(202);
    expect(switchedRequest.signal.aborted).toBe(false);
    expect(switchedRequest.isCurrent()).toBe(true);
    expect(result.current.incrementalStatus).toBe("reconciling");

    await act(async () => {
      userARequest.resolve(outcome("reconciled"));
      await Promise.resolve();
    });
    expect(mocks.invalidateSemanticSearchSessionCache).not.toHaveBeenCalledWith(USER_A);
    expect(result.current.incrementalStatus).toBe("reconciling");

    await act(async () => {
      userBRequest.resolve(outcome("idle"));
      await Promise.resolve();
    });
    expect(result.current.incrementalStatus).toBe("idle");
    unmount();
  });

  it("debounces a manual retry and aborts it when paused in flight", async () => {
    const retryRequest = deferred<ExtensionKnowledgeCoordinatorResult>();
    mocks.getKnowledgeConsent.mockResolvedValue(consent());
    mocks.reconcileExtensionKnowledge
      .mockResolvedValueOnce(outcome("baseline-created"))
      .mockReturnValueOnce(retryRequest.promise);
    const { result, unmount } = renderHook(() => useKnowledgeBuild());
    await flushImmediateEffects();

    expect(mocks.reconcileExtensionKnowledge).toHaveBeenCalledTimes(1);
    expect(result.current.incrementalStatus).toBe("idle");
    await act(async () => result.current.retry());
    expect(result.current.incrementalStatus).toBe("retrying");

    await act(async () => vi.advanceTimersByTimeAsync(1_999));
    expect(mocks.reconcileExtensionKnowledge).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(result.current.incrementalStatus).toBe("reconciling");
    const retrySignal = mocks.reconcileExtensionKnowledge.mock.calls[1][0].signal as AbortSignal;
    expect(retrySignal.aborted).toBe(false);

    act(() => result.current.pause());
    expect(retrySignal.aborted).toBe(true);
    expect(result.current.incrementalStatus).toBe("idle");
    await act(async () => {
      retryRequest.resolve(outcome("aborted"));
      await Promise.resolve();
    });
    expect(result.current.incrementalStatus).toBe("idle");
    unmount();
  });

  it("cancels a queued retry when paused before the debounce elapses", async () => {
    mocks.getKnowledgeConsent.mockResolvedValue(consent());
    mocks.reconcileExtensionKnowledge.mockResolvedValueOnce(outcome("baseline-created"));
    const { result, unmount } = renderHook(() => useKnowledgeBuild());
    await flushImmediateEffects();

    expect(mocks.reconcileExtensionKnowledge).toHaveBeenCalledTimes(1);
    expect(result.current.incrementalStatus).toBe("idle");
    await act(async () => result.current.retry());
    expect(result.current.incrementalStatus).toBe("retrying");

    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    act(() => result.current.pause());
    expect(result.current.incrementalStatus).toBe("idle");
    await act(async () => vi.advanceTimersByTimeAsync(3_000));

    expect(mocks.reconcileExtensionKnowledge).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("keeps extension reconciliation paused across cards, categories, and sections changes", async () => {
    mocks.getKnowledgeConsent.mockResolvedValue(consent());
    mocks.reconcileExtensionKnowledge.mockResolvedValue(outcome("baseline-created"));
    const { result, unmount } = renderHook(() => useKnowledgeBuild());
    await flushImmediateEffects();

    expect(mocks.reconcileExtensionKnowledge).toHaveBeenCalledTimes(1);
    expect(result.current.incrementalStatus).toBe("idle");
    act(() => result.current.pause());

    act(() => {
      useAppStore.setState({
        cards: [{ ...card(), title: "Changed while paused", updatedAt: 2 }],
        categories: [{
          id: "cat-tools",
          name: "Renamed tools",
          icon: "Wrench",
          color: "#4A6FA5",
          order: 0,
          createdAt: 1,
          updatedAt: 2,
        }],
        sections: [{
          id: "section-main",
          name: "Renamed main",
          order: 0,
          createdAt: 1,
          updatedAt: 2,
        }],
      });
    });
    await act(async () => vi.advanceTimersByTimeAsync(5_000));

    expect(result.current.incrementalStatus).toBe("idle");
    expect(mocks.reconcileExtensionKnowledge).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("suppresses an already scheduled automatic retry until the user retries manually", async () => {
    mocks.getKnowledgeConsent.mockResolvedValue(consent());
    mocks.reconcileExtensionKnowledge
      .mockRejectedValueOnce(new Error("temporary coordinator failure"))
      .mockResolvedValueOnce(outcome("idle"));
    const { result, unmount } = renderHook(() => useKnowledgeBuild());
    await flushImmediateEffects();

    expect(mocks.reconcileExtensionKnowledge).toHaveBeenCalledTimes(1);
    expect(result.current.incrementalStatus).toBe("error");
    act(() => result.current.pause());
    expect(result.current.incrementalStatus).toBe("idle");

    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    await flushImmediateEffects();
    expect(mocks.reconcileExtensionKnowledge).toHaveBeenCalledTimes(1);
    expect(result.current.incrementalStatus).toBe("idle");

    await act(async () => result.current.retry());
    await flushImmediateEffects();
    expect(mocks.reconcileExtensionKnowledge).toHaveBeenCalledTimes(2);
    expect(result.current.incrementalStatus).toBe("idle");
    unmount();
  });

  it("automatically retries a fenced workspace change without waiting for another UI update", async () => {
    mocks.getKnowledgeConsent.mockResolvedValue(consent());
    mocks.reconcileExtensionKnowledge
      .mockResolvedValueOnce(outcome("workspace-changed"))
      .mockResolvedValueOnce(outcome("idle"));
    const { result, unmount } = renderHook(() => useKnowledgeBuild());
    await flushImmediateEffects();

    expect(mocks.reconcileExtensionKnowledge).toHaveBeenCalledTimes(1);
    expect(result.current.incrementalStatus).toBe("retrying");
    await act(async () => vi.advanceTimersByTimeAsync(1_999));
    expect(mocks.reconcileExtensionKnowledge).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    await flushImmediateEffects();

    expect(mocks.reconcileExtensionKnowledge).toHaveBeenCalledTimes(2);
    expect(result.current.incrementalStatus).toBe("idle");
    unmount();
  });

  it.each([
    {
      signalName: "custom event",
      dispatch: () => window.dispatchEvent(new Event("webcollect:local-change")),
    },
    {
      signalName: "storage event",
      dispatch: () => window.dispatchEvent(new StorageEvent("storage", {
        key: "webcollect_local_snapshot_updated_at",
        newValue: "2",
      })),
    },
  ])("aborts an obsolete extension run and restarts after a $signalName", async ({ dispatch }) => {
    const obsoleteRun = deferred<ExtensionKnowledgeCoordinatorResult>();
    mocks.getKnowledgeConsent.mockResolvedValue(consent());
    mocks.reconcileExtensionKnowledge
      .mockResolvedValueOnce(outcome("baseline-created"))
      .mockReturnValueOnce(obsoleteRun.promise)
      .mockResolvedValueOnce(outcome("idle"));
    const { result, unmount } = renderHook(() => useKnowledgeBuild());
    await flushImmediateEffects();
    expect(mocks.reconcileExtensionKnowledge).toHaveBeenCalledTimes(1);

    act(() => {
      useAppStore.setState({
        cards: [{ ...card(), title: "First authoritative change", updatedAt: 2 }],
      });
    });
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(mocks.reconcileExtensionKnowledge).toHaveBeenCalledTimes(2);
    const obsoleteRequest = mocks.reconcileExtensionKnowledge.mock.calls[1][0];
    expect(obsoleteRequest.signal.aborted).toBe(false);
    expect(result.current.incrementalStatus).toBe("reconciling");

    act(() => {
      dispatch();
    });
    expect(obsoleteRequest.signal.aborted).toBe(true);
    expect(result.current.incrementalStatus).toBe("retrying");
    await act(async () => vi.advanceTimersByTimeAsync(1_999));
    expect(mocks.reconcileExtensionKnowledge).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(1));

    expect(mocks.reconcileExtensionKnowledge).toHaveBeenCalledTimes(3);
    const restartedRequest = mocks.reconcileExtensionKnowledge.mock.calls[2][0];
    expect(restartedRequest.signal.aborted).toBe(false);
    expect(restartedRequest.userId).toBe(USER_A);
    expect(result.current.incrementalStatus).toBe("idle");

    await act(async () => {
      obsoleteRun.resolve(outcome("reconciled"));
      await Promise.resolve();
    });
    expect(mocks.invalidateSemanticSearchSessionCache).not.toHaveBeenCalled();
    expect(result.current.incrementalStatus).toBe("idle");
    unmount();
  });
});
