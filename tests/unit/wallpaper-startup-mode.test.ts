import { beforeEach, describe, expect, it } from "vitest";
import {
  WALLPAPER_STARTUP_MODE_KEY,
  readWallpaperStartupMode,
  writeWallpaperStartupMode,
} from "@/lib/wallpaper-startup-mode";

describe("wallpaper startup mode mirror", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips both supported startup modes", () => {
    writeWallpaperStartupMode("collection");
    expect(readWallpaperStartupMode()).toBe("collection");

    writeWallpaperStartupMode("wallpaper");
    expect(readWallpaperStartupMode()).toBe("wallpaper");
  });

  it("ignores missing or invalid values", () => {
    expect(readWallpaperStartupMode()).toBeNull();
    window.localStorage.setItem(WALLPAPER_STARTUP_MODE_KEY, "invalid");
    expect(readWallpaperStartupMode()).toBeNull();
  });
});
