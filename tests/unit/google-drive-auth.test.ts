import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthToken: vi.fn(),
  removeCachedAuthToken: vi.fn(),
  clearAllCachedAuthTokens: vi.fn(),
}));

vi.mock("@/lib/platform", () => ({ isChromeExtension: () => true }));

import {
  GOOGLE_DRIVE_APPDATA_SCOPE,
  getGoogleDriveAccessToken,
  invalidateGoogleDriveAccessToken,
} from "@/lib/google-drive-auth";

describe("Google Drive Chrome identity", () => {
  beforeEach(() => {
    mocks.getAuthToken.mockReset();
    mocks.removeCachedAuthToken.mockReset();
    mocks.clearAllCachedAuthTokens.mockReset();
    vi.stubGlobal("chrome", {
      identity: {
        getAuthToken: mocks.getAuthToken,
        removeCachedAuthToken: mocks.removeCachedAuthToken,
        clearAllCachedAuthTokens: mocks.clearAllCachedAuthTokens,
      },
    });
  });

  it("requests only drive.appdata and only becomes interactive on explicit connect", async () => {
    mocks.getAuthToken.mockResolvedValue({ token: "temporary-token" });

    await expect(getGoogleDriveAccessToken(true)).resolves.toBe("temporary-token");
    expect(mocks.getAuthToken).toHaveBeenCalledWith({
      interactive: true,
      scopes: [GOOGLE_DRIVE_APPDATA_SCOPE],
    });
  });

  it("invalidates only the expired Chrome-managed token", async () => {
    mocks.removeCachedAuthToken.mockResolvedValue(undefined);

    await invalidateGoogleDriveAccessToken("expired-token");

    expect(mocks.removeCachedAuthToken).toHaveBeenCalledWith({ token: "expired-token" });
  });
});
