import type { WallpaperItem, WallpaperThemeMode } from "./wallpaper-types";

export type QuoteKind = "general" | "pet" | "movie" | "tv" | "art" | "space" | "fallback";

export type QuoteTone =
  | "epic"
  | "calm"
  | "healing"
  | "romantic"
  | "philosophical"
  | "dark"
  | "funny"
  | "minimal"
  | "cinematic";

export type QuoteConfidence = "high" | "medium" | "low";

export type QuoteMatchReason =
  | "exact-asset"
  | "same-movie"
  | "same-tv"
  | "source-title"
  | "mode-kind"
  | "tag"
  | "general"
  | "fallback"
  | "direct-id";

export interface WallpaperQuote {
  id: string;
  kind: QuoteKind;
  zh: string;
  en: string;
  source: string;
  author?: string;
  speaker?: string;
  sourceTitle?: string;
  originalTitle?: string;
  sourceYear?: number;
  mediaType?: "movie" | "tv";
  tmdbId?: number;
  tvId?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  exactAssetId?: string;
  tags: string[];
  tone: QuoteTone[];
  verified: boolean;
  confidence: QuoteConfidence;
  sourceNote?: string;
  createdAt?: string;
}

export interface WallpaperQuoteSelection {
  quote: WallpaperQuote;
  reason: QuoteMatchReason;
}

export interface QuoteValidationResult {
  valid: boolean;
  reason?: string;
}

const CREATED_AT = "2026-06-21";
const MAX_QUOTE_TEXT_LENGTH = 220;
const PLACEHOLDER_PATTERN = /\b(todo|tbd|placeholder|lorem|待补|占位)\b/i;

function quote(entry: WallpaperQuote): WallpaperQuote {
  return entry;
}

const LEGACY_QUOTES: WallpaperQuote[] = [
  quote({
    id: "quiet-horizon",
    kind: "general",
    zh: "天地有大美而不言。",
    en: "Heaven and earth hold great beauty, and do not speak.",
    source: "《庄子·知北游》 / Zhuangzi",
    author: "Zhuangzi",
    tags: ["nature", "calm", "philosophy", "landscape"],
    tone: ["calm", "philosophical"],
    verified: true,
    confidence: "high",
    createdAt: CREATED_AT,
  }),
  quote({
    id: "single-earth",
    kind: "space",
    zh: "万物并育而不相害。",
    en: "All things grow together, and do not harm one another.",
    source: "《中庸》 / The Doctrine of the Mean",
    tags: ["earth", "space", "harmony"],
    tone: ["philosophical", "calm"],
    verified: true,
    confidence: "high",
    createdAt: CREATED_AT,
  }),
  quote({
    id: "cosmic-patience",
    kind: "space",
    zh: "仰观宇宙之大，俯察品类之盛。",
    en: "Look up to the vast cosmos; look down to life in its abundance.",
    source: "王羲之《兰亭集序》 / Wang Xizhi",
    author: "Wang Xizhi",
    tags: ["space", "cosmos", "life"],
    tone: ["epic", "philosophical"],
    verified: true,
    confidence: "high",
    createdAt: CREATED_AT,
  }),
  quote({
    id: "old-stone",
    kind: "general",
    zh: "逝者如斯夫，不舍昼夜。",
    en: "What passes is like this stream, never ceasing day or night.",
    source: "《论语·子罕》 / The Analects",
    tags: ["time", "river", "philosophy"],
    tone: ["philosophical", "calm"],
    verified: true,
    confidence: "high",
    createdAt: CREATED_AT,
  }),
  quote({
    id: "water-still",
    kind: "general",
    zh: "上善若水。",
    en: "The highest good is like water.",
    source: "《道德经》 / Tao Te Ching",
    tags: ["water", "ocean", "lake", "calm"],
    tone: ["minimal", "philosophical"],
    verified: true,
    confidence: "high",
    createdAt: CREATED_AT,
  }),
  quote({
    id: "patient-life",
    kind: "pet",
    zh: "草木有本心，何求美人折。",
    en: "Grass and trees keep their own heart; why seek to be plucked?",
    source: "张九龄《感遇》 / Zhang Jiuling",
    author: "Zhang Jiuling",
    tags: ["life", "animals", "nature", "healing"],
    tone: ["calm", "philosophical"],
    verified: true,
    confidence: "high",
    createdAt: CREATED_AT,
  }),
  quote({
    id: "wide-sky",
    kind: "general",
    zh: "海阔凭鱼跃，天高任鸟飞。",
    en: "The sea is wide for fish to leap; the sky is high for birds to fly.",
    source: "古语 / Chinese proverb",
    tags: ["sky", "ocean", "freedom", "bird"],
    tone: ["epic", "calm"],
    verified: true,
    confidence: "high",
    createdAt: CREATED_AT,
  }),
  quote({
    id: "city-dawn",
    kind: "general",
    zh: "日出而作，日入而息。",
    en: "At sunrise, work; at sunset, rest.",
    source: "《击壤歌》 / Song of the Clod",
    tags: ["city", "dawn", "daily"],
    tone: ["minimal", "calm"],
    verified: true,
    confidence: "high",
    createdAt: CREATED_AT,
  }),
  quote({
    id: "earth-fire",
    kind: "general",
    zh: "生生之谓易。",
    en: "Ceaseless becoming is what change means.",
    source: "《周易·系辞》 / I Ching",
    tags: ["change", "fire", "earth"],
    tone: ["philosophical", "epic"],
    verified: true,
    confidence: "high",
    createdAt: CREATED_AT,
  }),
  quote({
    id: "mountain-rain",
    kind: "general",
    zh: "空山新雨后，天气晚来秋。",
    en: "After fresh rain in empty mountains, evening air carries autumn.",
    source: "王维《山居秋暝》 / Wang Wei",
    author: "Wang Wei",
    tags: ["mountain", "rain", "forest", "landscape"],
    tone: ["calm", "healing"],
    verified: true,
    confidence: "high",
    createdAt: CREATED_AT,
  }),
  quote({
    id: "climb-high",
    kind: "general",
    zh: "会当凌绝顶，一览众山小。",
    en: "One day I shall stand on the summit and see all other mountains made small.",
    source: "杜甫《望岳》 / Du Fu",
    author: "Du Fu",
    tags: ["mountain", "height", "summit", "journey", "resilience", "landscape"],
    tone: ["epic", "philosophical"],
    verified: true,
    confidence: "high",
    createdAt: CREATED_AT,
  }),
  quote({
    id: "rock-path",
    kind: "general",
    zh: "路虽远，行则将至；事虽难，做则必成。",
    en: "However distant the road, walking reaches it; however hard the work, doing completes it.",
    source: "《荀子》意译 / Xunzi, paraphrased",
    author: "Xunzi",
    tags: ["journey", "rock", "path", "resilience", "mountain"],
    tone: ["philosophical", "epic"],
    verified: true,
    confidence: "high",
    createdAt: CREATED_AT,
  }),
  quote({
    id: "sea-moon",
    kind: "general",
    zh: "海上生明月，天涯共此时。",
    en: "The bright moon rises over the sea; far apart, we share this moment.",
    source: "张九龄《望月怀远》 / Zhang Jiuling",
    author: "Zhang Jiuling",
    tags: ["moon", "sea", "romantic"],
    tone: ["romantic", "calm"],
    verified: true,
    confidence: "high",
    createdAt: CREATED_AT,
  }),
  quote({
    id: "hundred-journeys",
    kind: "general",
    zh: "千里之行，始于足下。",
    en: "A journey of a thousand miles begins beneath one's feet.",
    source: "《道德经》 / Tao Te Ching",
    tags: ["journey", "work", "begin"],
    tone: ["minimal", "philosophical"],
    verified: true,
    confidence: "high",
    createdAt: CREATED_AT,
  }),
];

const GENERAL_SUBJECTS: Array<[string, string, string[]]> = [
  ["晨光", "Morning light", ["dawn", "light"]],
  ["远山", "Distant mountains", ["mountain", "landscape"]],
  ["湖面", "A quiet lake", ["lake", "water"]],
  ["城市的窗", "City windows", ["city", "landmark"]],
  ["海风", "Sea wind", ["ocean", "sea"]],
  ["雨后的路", "The road after rain", ["rain", "path"]],
  ["森林深处", "The depth of the forest", ["forest", "nature"]],
  ["黄昏", "Dusk", ["dusk", "city"]],
  ["云影", "Cloud shadows", ["cloud", "weather"]],
  ["桥上的灯", "Lights on the bridge", ["bridge", "city"]],
  ["石阶", "Old stone steps", ["stone", "monument"]],
  ["潮汐", "The tide", ["ocean", "water"]],
  ["雪线", "The snowline", ["snow", "mountain"]],
  ["一阵风", "A passing wind", ["wind", "sky"]],
  ["河湾", "A river bend", ["river", "water"]],
  ["月色", "Moonlight", ["moon", "night"]],
  ["旷野", "Open country", ["field", "landscape"]],
  ["庭院", "A quiet courtyard", ["garden", "architecture"]],
  ["星光", "Starlight", ["space", "night"]],
  ["日落", "Sunset", ["sunset", "ocean"]],
  ["小路", "A narrow path", ["path", "journey"]],
  ["清水", "Clear water", ["water", "calm"]],
  ["旧墙", "An old wall", ["old", "monument"]],
  ["树影", "Tree shadows", ["tree", "forest"]],
  ["山谷", "A valley", ["valley", "mountain"]],
  ["静夜", "A still night", ["night", "calm"]],
  ["码头", "The harbor", ["harbor", "ocean"]],
  ["屋檐", "The eaves", ["home", "architecture"]],
  ["晴空", "Open sky", ["sky", "light"]],
  ["归途", "The way home", ["journey", "home"]],
];

const GENERAL_ACTIONS: Array<[string, string, QuoteTone[], string[]]> = [
  ["提醒我们先把一件小事做好。", "reminds us to finish one small thing first.", ["calm", "minimal"], ["work"]],
  ["让纷乱的心慢慢安静下来。", "lets a crowded mind become quiet again.", ["calm", "healing"], ["healing"]],
  ["把答案留给愿意等待的人。", "keeps its answer for those willing to wait.", ["philosophical", "calm"], ["patience"]],
  ["不催促，也不后退。", "does not hurry, and does not step back.", ["minimal", "philosophical"], ["steady"]],
  ["告诉我们，美常常来自克制。", "tells us that beauty often comes from restraint.", ["philosophical", "minimal"], ["beauty"]],
];

const PET_SUBJECTS: Array<[string, string, string[]]> = [
  ["一只猫", "A cat", ["cat", "pet"]],
  ["一只狗", "A dog", ["dog", "pet"]],
  ["小爪印", "Tiny pawprints", ["paw", "pet"]],
  ["午睡的毛团", "A napping ball of fur", ["sleep", "pet"]],
  ["摇尾巴的早晨", "A tail-wagging morning", ["dog", "morning"]],
  ["窗边的猫", "The cat by the window", ["cat", "window"]],
  ["雪地里的狗", "The dog in the snow", ["dog", "snow"]],
  ["打盹的小伙伴", "A little friend taking a nap", ["sleep", "companion"]],
  ["湿漉漉的鼻尖", "A damp little nose", ["dog", "cute"]],
  ["阳光里的耳朵", "Ears in the sunlight", ["sun", "cute"]],
  ["圆眼睛", "Round eyes", ["cute", "pet"]],
  ["一声轻轻的呼噜", "A quiet purr", ["cat", "purr"]],
  ["小小的脚步声", "Small footsteps", ["paw", "home"]],
  ["沙发角落", "The corner of the sofa", ["home", "pet"]],
  ["一团温暖", "A small bundle of warmth", ["warm", "healing"]],
  ["等门的小影子", "A little shadow waiting by the door", ["home", "waiting"]],
  ["冒险的小鼻子", "A curious little nose", ["curious", "pet"]],
  ["抱枕旁边", "Beside the pillow", ["home", "sleep"]],
  ["草地上的奔跑", "A run across the grass", ["grass", "dog"]],
  ["认真看世界的脸", "A face studying the world", ["cute", "curious"]],
];

const PET_ACTIONS: Array<[string, string, QuoteTone[], string[]]> = [
  ["把普通的一天变软了。", "makes an ordinary day softer.", ["healing", "calm"], ["soft"]],
  ["不解释爱，只把它放在你身边。", "does not explain love; it simply stays beside you.", ["healing", "romantic"], ["love"]],
  ["让家听起来更像家。", "makes home sound more like home.", ["healing", "minimal"], ["home"]],
  ["提醒你，慢一点也很好。", "reminds you that slower can be better.", ["calm", "healing"], ["slow"]],
];

const CINEMA_SUBJECTS: Array<[string, string, string[]]> = [
  ["银幕尽头的光", "The light at the edge of the frame", ["cinema", "light"]],
  ["雨夜里的车窗", "A rain-streaked car window", ["rain", "cinema"]],
  ["空荡荡的车站", "An empty station", ["station", "journey"]],
  ["最后一排座位", "The last row of seats", ["cinema", "memory"]],
  ["城市霓虹", "City neon", ["city", "night"]],
  ["一封未寄出的信", "An unsent letter", ["letter", "romantic"]],
  ["远处的火车声", "A train far away", ["train", "journey"]],
  ["海边的长镜头", "A long shot by the sea", ["ocean", "cinema"]],
  ["片尾后的沉默", "The silence after the credits", ["cinema", "quiet"]],
  ["逆光里的背影", "A silhouette against the light", ["light", "cinematic"]],
  ["午夜的街口", "A midnight street corner", ["city", "night"]],
  ["旧胶片的颗粒", "The grain of old film", ["film", "art"]],
  ["门缝里的光", "Light under the door", ["light", "suspense"]],
  ["风吹过空房间", "Wind through an empty room", ["wind", "room"]],
  ["没有说完的话", "Words left unfinished", ["dialogue", "romantic"]],
  ["镜头停住的那一秒", "The second the camera holds", ["camera", "cinema"]],
  ["黄昏里的告别", "A farewell at dusk", ["dusk", "farewell"]],
  ["黑暗中的脚步", "Footsteps in the dark", ["dark", "suspense"]],
  ["灯灭之前", "Before the lights go out", ["light", "cinema"]],
  ["一座醒来的城市", "A city waking up", ["city", "dawn"]],
];

const CINEMA_ACTIONS: Array<[string, string, QuoteTone[], string[]]> = [
  ["总会把人带回某个决定之前。", "always returns us to the moment before a choice.", ["cinematic", "philosophical"], ["choice"]],
  ["像一句没有说出口的台词。", "feels like a line nobody says out loud.", ["cinematic", "calm"], ["line"]],
  ["让命运先安静几秒。", "lets fate stay quiet for a few seconds.", ["cinematic", "epic"], ["fate"]],
  ["把故事交给下一次呼吸。", "hands the story to the next breath.", ["cinematic", "minimal"], ["story"]],
];

const TV_SUBJECTS: Array<[string, string, string[]]> = [
  ["下一集开始前", "Before the next episode begins", ["tv", "episode"]],
  ["厨房桌边的灯", "The lamp by the kitchen table", ["home", "tv"]],
  ["楼道里的回声", "Echoes in the hallway", ["hallway", "drama"]],
  ["办公室的深夜", "A late night at the office", ["office", "work"]],
  ["客厅里的沉默", "Silence in the living room", ["home", "drama"]],
  ["案板上的咖啡杯", "A coffee cup on the counter", ["coffee", "daily"]],
  ["电话铃响之前", "Before the phone rings", ["phone", "suspense"]],
  ["门外的脚步声", "Footsteps outside the door", ["door", "suspense"]],
  ["季终的雨", "Rain at the season finale", ["rain", "tv"]],
  ["旧照片上的笑", "A smile in an old photo", ["memory", "family"]],
  ["电梯停下时", "When the elevator stops", ["elevator", "drama"]],
  ["街角的早餐店", "The breakfast place on the corner", ["city", "daily"]],
  ["没有关掉的台灯", "The lamp left on", ["home", "night"]],
  ["屏幕里的倒影", "A reflection in the screen", ["screen", "tv"]],
  ["同一张餐桌", "The same dining table", ["family", "home"]],
];

const TV_ACTIONS: Array<[string, string, QuoteTone[], string[]]> = [
  ["让日常也有了悬念。", "turns ordinary life into suspense.", ["cinematic", "minimal"], ["daily"]],
  ["把关系推到更近的地方。", "moves every relationship a little closer.", ["romantic", "calm"], ["relationship"]],
  ["证明故事不是一天讲完的。", "proves that a story is not told in a single day.", ["philosophical", "cinematic"], ["story"]],
  ["等着一个人先开口。", "waits for someone to speak first.", ["calm", "dark"], ["dialogue"]],
];

const FALLBACK_SUBJECTS: Array<[string, string, string[]]> = [
  ["今天", "Today", ["fallback"]],
  ["此刻", "This moment", ["fallback"]],
  ["眼前的光", "The light before you", ["fallback"]],
  ["一小步", "One small step", ["fallback"]],
  ["安静", "Quiet", ["fallback"]],
  ["新的开始", "A fresh beginning", ["fallback"]],
  ["窗外", "Outside the window", ["fallback"]],
  ["下一秒", "The next second", ["fallback"]],
  ["柔和的风", "A gentle wind", ["fallback"]],
  ["仍然可爱的世界", "A world still worth liking", ["fallback"]],
];

const FALLBACK_ACTIONS: Array<[string, string, QuoteTone[], string[]]> = [
  ["也值得被认真看见。", "is still worth seeing clearly.", ["calm", "minimal"], ["safe"]],
  ["不需要很响，也可以很好。", "does not need to be loud to be good.", ["healing", "minimal"], ["safe"]],
  ["先陪你停一下。", "will sit with you for a while.", ["healing", "calm"], ["safe"]],
];

function expandOriginalQuotes(
  kind: QuoteKind,
  idPrefix: string,
  source: string,
  subjects: Array<[string, string, string[]]>,
  actions: Array<[string, string, QuoteTone[], string[]]>,
  extra?: Partial<Pick<WallpaperQuote, "mediaType" | "sourceTitle" | "speaker" | "sourceNote">>
): WallpaperQuote[] {
  const entries: WallpaperQuote[] = [];
  for (let subjectIndex = 0; subjectIndex < subjects.length; subjectIndex += 1) {
    const [zhSubject, enSubject, subjectTags] = subjects[subjectIndex]!;
    for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
      const [zhAction, enAction, tone, actionTags] = actions[actionIndex]!;
      entries.push(quote({
        id: `${idPrefix}-${subjectIndex + 1}-${actionIndex + 1}`,
        kind,
        zh: `${zhSubject}${zhAction}`,
        en: `${enSubject} ${enAction}`,
        source,
        tags: Array.from(new Set([kind, ...subjectTags, ...actionTags])),
        tone,
        verified: true,
        confidence: "high",
        createdAt: CREATED_AT,
        ...extra,
      }));
    }
  }
  return entries;
}

const GENERAL_QUOTES = expandOriginalQuotes(
  "general",
  "general-original",
  "WebCollect 原创双语短句 / WebCollect original",
  GENERAL_SUBJECTS,
  GENERAL_ACTIONS
);

const PET_QUOTES = expandOriginalQuotes(
  "pet",
  "pet-original",
  "WebCollect 萌宠原创短句 / WebCollect pet original",
  PET_SUBJECTS,
  PET_ACTIONS
);

const CINEMA_QUOTES = expandOriginalQuotes(
  "movie",
  "cinema-original",
  "Cinema Mode 原创氛围台词 / Original cinematic caption",
  CINEMA_SUBJECTS,
  CINEMA_ACTIONS,
  {
    mediaType: "movie",
    sourceTitle: "Cinema Mode",
    speaker: "Narrator",
    sourceNote: "Original cinematic caption, not a quote from an existing copyrighted film.",
  }
);

const TV_QUOTES = expandOriginalQuotes(
  "tv",
  "tv-original",
  "TV Mode 原创剧集氛围台词 / Original serial-story caption",
  TV_SUBJECTS,
  TV_ACTIONS,
  {
    mediaType: "tv",
    sourceTitle: "TV Mode",
    speaker: "Narrator",
    sourceNote: "Original serial-story caption, not a quote from an existing copyrighted TV show.",
  }
);

const FALLBACK_QUOTES = expandOriginalQuotes(
  "fallback",
  "fallback-original",
  "WebCollect 兜底短句 / WebCollect fallback",
  FALLBACK_SUBJECTS,
  FALLBACK_ACTIONS
);

export const WALLPAPER_QUOTES: WallpaperQuote[] = [
  ...LEGACY_QUOTES,
  ...GENERAL_QUOTES,
  ...PET_QUOTES,
  ...CINEMA_QUOTES,
  ...TV_QUOTES,
  ...FALLBACK_QUOTES,
].filter((entry) => validateWallpaperQuote(entry).valid);

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ").trim();
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function isSameMovieQuote(quote: WallpaperQuote, wallpaper: WallpaperItem): boolean {
  if (quote.mediaType !== "movie" || !quote.tmdbId) return false;
  return wallpaper.tags?.some((tag) => tag === `tmdb:${quote.tmdbId}`) || false;
}

function isSameTvQuote(quote: WallpaperQuote, wallpaper: WallpaperItem): boolean {
  if (quote.mediaType !== "tv" || !quote.tvId) return false;
  return wallpaper.tags?.some((tag) => tag === `tvdb:${quote.tvId}` || tag === `tmdb-tv:${quote.tvId}`) || false;
}

function isSameSourceTitleQuote(quote: WallpaperQuote, wallpaper: WallpaperItem): boolean {
  if (!quote.sourceTitle) return false;
  const sourceTitle = normalizeText(quote.sourceTitle);
  if (!sourceTitle || sourceTitle === "cinema mode" || sourceTitle === "tv mode") return false;
  return normalizeText(wallpaper.title).includes(sourceTitle)
    || normalizeText(wallpaper.sourceCollection).includes(sourceTitle);
}

function getAssetSearchText(wallpaper: WallpaperItem, themeMode: WallpaperThemeMode): string {
  return normalizeText([
    wallpaper.id,
    wallpaper.title,
    wallpaper.author,
    wallpaper.category,
    wallpaper.sourceCollection,
    wallpaper.provider,
    themeMode,
    ...(wallpaper.tags || []),
  ].filter(Boolean).join(" "));
}

function getPreferredKinds(wallpaper: WallpaperItem, themeMode: WallpaperThemeMode): QuoteKind[] {
  if (themeMode === "pets") return ["pet", "general", "fallback"];
  if (themeMode === "cinema") return ["movie", "general", "fallback"];
  if (themeMode === "tv") return ["tv", "general", "fallback"];
  if (themeMode === "art") return ["art", "general", "fallback"];
  if (themeMode === "space") return ["space", "general", "fallback"];
  if (wallpaper.category === "animals") return ["pet", "general", "fallback"];
  if (wallpaper.category === "space") return ["space", "general", "fallback"];
  return ["general", "fallback"];
}

export function isSyntheticWallpaperQuote(quote: WallpaperQuote): boolean {
  return /WebCollect .*original|WebCollect .*原创|WebCollect fallback|WebCollect 兜底|原创短句|原创氛围台词|Original cinematic caption|Original serial-story caption/i
    .test(`${quote.id} ${quote.source} ${quote.sourceNote || ""}`);
}

function allowsSyntheticQuotes(themeMode: WallpaperThemeMode): boolean {
  return themeMode === "cinema" || themeMode === "tv";
}

function getSemanticQuoteTags(assetText: string): string[] {
  if (/(mountain|stone|cliff|rock|gorge|canyon|granite|summit|peak|valley|piana|tarn|geopark|mesa|desert)/.test(assetText)) {
    return ["mountain", "stone", "rock", "journey", "height", "summit", "resilience", "landscape"];
  }
  if (/(ocean|sea|coast|lake|river|bay|fjord|island|tide|wave|water|reflection)/.test(assetText)) {
    return ["water", "ocean", "sea", "lake", "river", "tide"];
  }
  if (/(city|market|church|temple|palace|bridge|tower|street|dawn|sunrise|skyline)/.test(assetText)) {
    return ["city", "dawn", "daily", "landmark"];
  }
  if (/(animal|bird|deer|gazelle|eagle|ibex|lion|wolf|wildlife|cat|dog|pet)/.test(assetText)) {
    return ["animals", "nature", "life", "healing", "pet"];
  }
  if (/(forest|tree|trail|field|landscape|nature|horizon)/.test(assetText)) {
    return ["nature", "landscape", "forest", "calm", "journey"];
  }
  return [];
}

function pickQuote(candidates: WallpaperQuote[], recentQuoteIds: string[], seed: string): WallpaperQuote | null {
  if (candidates.length === 0) return null;
  const recent = new Set(recentQuoteIds);
  const fresh = candidates.filter((candidate) => !recent.has(candidate.id));
  const pool = fresh.length > 0 ? fresh : candidates;
  return pool[hashString(seed) % pool.length] || null;
}

export function validateWallpaperQuote(entry: WallpaperQuote): QuoteValidationResult {
  if (!entry.id.trim()) return { valid: false, reason: "missing id" };
  if (!entry.zh.trim() || !entry.en.trim()) return { valid: false, reason: "missing bilingual text" };
  if (!entry.source.trim()) return { valid: false, reason: "missing source" };
  if (entry.zh.length + entry.en.length > MAX_QUOTE_TEXT_LENGTH) return { valid: false, reason: "too long for overlay" };
  if (PLACEHOLDER_PATTERN.test(`${entry.zh} ${entry.en} ${entry.source}`)) return { valid: false, reason: "placeholder text" };
  if (!Array.isArray(entry.tags) || entry.tags.length === 0) return { valid: false, reason: "missing tags" };
  if (!Array.isArray(entry.tone) || entry.tone.length === 0) return { valid: false, reason: "missing tone" };
  if ((entry.mediaType === "movie" || entry.kind === "movie") && !entry.sourceTitle && !entry.tmdbId && !entry.exactAssetId) {
    return { valid: false, reason: "movie quote missing binding metadata" };
  }
  if ((entry.mediaType === "tv" || entry.kind === "tv") && !entry.sourceTitle && !entry.tvId && !entry.exactAssetId) {
    return { valid: false, reason: "tv quote missing binding metadata" };
  }
  return { valid: true };
}

export function getWallpaperQuote(id: string): WallpaperQuote {
  return WALLPAPER_QUOTES.find((item) => item.id === id)
    || WALLPAPER_QUOTES.find((item) => item.kind === "fallback")
    || WALLPAPER_QUOTES[0]!;
}

export function getWallpaperQuoteCounts(): Record<QuoteKind, number> {
  return WALLPAPER_QUOTES.reduce<Record<QuoteKind, number>>((counts, item) => {
    counts[item.kind] = (counts[item.kind] || 0) + 1;
    return counts;
  }, {
    general: 0,
    pet: 0,
    movie: 0,
    tv: 0,
    art: 0,
    space: 0,
    fallback: 0,
  });
}

export function selectWallpaperQuote({
  wallpaper,
  themeMode = "auto",
  recentQuoteIds = [],
}: {
  wallpaper: WallpaperItem;
  themeMode?: WallpaperThemeMode;
  recentQuoteIds?: string[];
}): WallpaperQuoteSelection {
  const seed = `${wallpaper.id}:${themeMode}:${recentQuoteIds.slice(0, 8).join("|")}`;
  const assetText = getAssetSearchText(wallpaper, themeMode);
  const validQuotes = allowsSyntheticQuotes(themeMode)
    ? WALLPAPER_QUOTES
    : WALLPAPER_QUOTES.filter((item) => !isSyntheticWallpaperQuote(item));

  const exactAsset = pickQuote(validQuotes.filter((item) => item.exactAssetId === wallpaper.id), recentQuoteIds, `${seed}:exact`);
  if (exactAsset) return { quote: exactAsset, reason: "exact-asset" };

  const movie = pickQuote(validQuotes.filter((item) => isSameMovieQuote(item, wallpaper)), recentQuoteIds, `${seed}:movie`);
  if (movie) return { quote: movie, reason: "same-movie" };

  const tv = pickQuote(validQuotes.filter((item) => isSameTvQuote(item, wallpaper)), recentQuoteIds, `${seed}:tv`);
  if (tv) return { quote: tv, reason: "same-tv" };

  const sourceTitle = pickQuote(validQuotes.filter((item) => isSameSourceTitleQuote(item, wallpaper)), recentQuoteIds, `${seed}:source`);
  if (sourceTitle) return { quote: sourceTitle, reason: "source-title" };

  const shouldPreferSemanticTags = themeMode === "auto" || themeMode === "nature";
  const semanticTags = shouldPreferSemanticTags ? getSemanticQuoteTags(assetText) : [];
  if (semanticTags.length > 0) {
    const semantic = pickQuote(
      validQuotes.filter((item) => item.tags.some((tag) => semanticTags.includes(normalizeText(tag)))),
      recentQuoteIds,
      `${seed}:semantic`
    );
    if (semantic) return { quote: semantic, reason: "tag" };
  }

  const preferredKinds = getPreferredKinds(wallpaper, themeMode);
  for (const kind of preferredKinds) {
    const byKind = pickQuote(validQuotes.filter((item) => item.kind === kind), recentQuoteIds, `${seed}:kind:${kind}`);
    if (byKind) {
      return {
        quote: byKind,
        reason: kind === "general" ? "general" : kind === "fallback" ? "fallback" : "mode-kind",
      };
    }
  }

  const byTag = pickQuote(
    validQuotes.filter((item) => item.tags.some((tag) => assetText.includes(normalizeText(tag)))),
    recentQuoteIds,
    `${seed}:tag`
  );
  if (byTag) return { quote: byTag, reason: "tag" };

  const fallback = pickQuote(validQuotes.filter((item) => item.kind === "fallback"), recentQuoteIds, `${seed}:fallback`);
  return { quote: fallback || getWallpaperQuote("quiet-horizon"), reason: "fallback" };
}
