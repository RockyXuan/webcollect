export interface WallpaperQuote {
  id: string;
  zh: string;
  en: string;
  source: string;
}

export const WALLPAPER_QUOTES: WallpaperQuote[] = [
  {
    id: "quiet-horizon",
    zh: "天地有大美而不言。",
    en: "Heaven and earth hold great beauty, and do not speak.",
    source: "《庄子·知北游》 / Zhuangzi",
  },
  {
    id: "single-earth",
    zh: "万物并育而不相害。",
    en: "All things grow together, and do not harm one another.",
    source: "《中庸》 / The Doctrine of the Mean",
  },
  {
    id: "cosmic-patience",
    zh: "仰观宇宙之大，俯察品类之盛。",
    en: "Look up to the vast cosmos; look down to life in its abundance.",
    source: "王羲之《兰亭集序》 / Wang Xizhi",
  },
  {
    id: "old-stone",
    zh: "逝者如斯夫，不舍昼夜。",
    en: "What passes is like this stream, never ceasing day or night.",
    source: "《论语·子罕》 / The Analects",
  },
  {
    id: "water-still",
    zh: "上善若水。",
    en: "The highest good is like water.",
    source: "《道德经》 / Tao Te Ching",
  },
  {
    id: "patient-life",
    zh: "草木有本心，何求美人折。",
    en: "Grass and trees keep their own heart; why seek to be plucked?",
    source: "张九龄《感遇》 / Zhang Jiuling",
  },
  {
    id: "wide-sky",
    zh: "海阔凭鱼跃，天高任鸟飞。",
    en: "The sea is wide for fish to leap; the sky is high for birds to fly.",
    source: "古语 / Chinese proverb",
  },
  {
    id: "city-dawn",
    zh: "日出而作，日入而息。",
    en: "At sunrise, work; at sunset, rest.",
    source: "《击壤歌》 / Song of the Clod",
  },
  {
    id: "earth-fire",
    zh: "生生之谓易。",
    en: "Ceaseless becoming is what change means.",
    source: "《周易·系辞》 / I Ching",
  },
];

export function getWallpaperQuote(id: string): WallpaperQuote {
  return WALLPAPER_QUOTES.find((quote) => quote.id === id) || WALLPAPER_QUOTES[0]!;
}
