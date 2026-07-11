const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".home.arpa",
  ".test",
  ".invalid",
];

export class RemoteUrlPolicyError extends Error {
  constructor(message) {
    super(message);
    this.name = "RemoteUrlPolicyError";
  }
}

function normalizeHost(hostname) {
  return String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
}

function parseIpv4(address) {
  const parts = normalizeHost(address).split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return octets;
}

function expandIpv6(address) {
  let value = normalizeHost(address).split("%")[0];
  if (!value.includes(":")) return null;

  const ipv4Match = value.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (ipv4Match) {
    const ipv4 = parseIpv4(ipv4Match[1]);
    if (!ipv4) return null;
    const first = ((ipv4[0] << 8) | ipv4[1]).toString(16);
    const second = ((ipv4[2] << 8) | ipv4[3]).toString(16);
    value = value.slice(0, -ipv4Match[1].length) + `${first}:${second}`;
  }

  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const groups = [
    ...left,
    ...Array(halves.length === 2 ? missing : 0).fill("0"),
    ...right,
  ];
  if (groups.length !== 8) return null;
  const numbers = groups.map((group) => Number.parseInt(group || "0", 16));
  if (numbers.some((group) => !Number.isInteger(group) || group < 0 || group > 0xffff)) {
    return null;
  }
  return numbers;
}

function isPublicIpv4(address) {
  const octets = parseIpv4(address);
  if (!octets) return false;
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168)) return false;
  if (a === 192 && b === 0 && octets[2] === 2) return false;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
  if (a === 203 && b === 0 && octets[2] === 113) return false;
  if (a >= 224) return false;
  return true;
}

function isPublicIpv6(address) {
  const groups = expandIpv6(address);
  if (!groups) return false;
  const first = groups[0];
  const allZero = groups.every((group) => group === 0);
  const loopback = groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1;
  if (allZero || loopback) return false;
  if ((first & 0xfe00) === 0xfc00) return false;
  if ((first & 0xffc0) === 0xfe80) return false;
  if ((first & 0xff00) === 0xff00) return false;
  if (first === 0x2001 && groups[1] === 0x0db8) return false;
  if (first === 0x0100 && groups.slice(1, 4).every((group) => group === 0)) return false;

  const isMappedIpv4 = groups.slice(0, 5).every((group) => group === 0)
    && groups[5] === 0xffff;
  const isCompatibleIpv4 = groups.slice(0, 6).every((group) => group === 0);
  const isNat64WellKnown = groups[0] === 0x0064
    && groups[1] === 0xff9b
    && groups.slice(2, 6).every((group) => group === 0);
  if (isMappedIpv4 || isCompatibleIpv4 || isNat64WellKnown) {
    const mapped = [
      groups[6] >> 8,
      groups[6] & 0xff,
      groups[7] >> 8,
      groups[7] & 0xff,
    ].join(".");
    return isPublicIpv4(mapped);
  }
  if (first === 0x2002) {
    const sixToFour = [
      groups[1] >> 8,
      groups[1] & 0xff,
      groups[2] >> 8,
      groups[2] & 0xff,
    ].join(".");
    return isPublicIpv4(sixToFour);
  }
  if (first === 0x2001 && groups[1] === 0) return false;
  return true;
}

export function isPublicIpAddress(address) {
  const normalized = normalizeHost(address);
  if (normalized.includes(":")) return isPublicIpv6(normalized);
  return isPublicIpv4(normalized);
}

function looksLikeIpAddress(hostname) {
  const normalized = normalizeHost(hostname);
  return normalized.includes(":") || parseIpv4(normalized) !== null;
}

export function assertSafeRemoteUrl(input) {
  if (String(input || "").length > 4_096) {
    throw new RemoteUrlPolicyError("URL 长度超过限制");
  }
  let parsed;
  try {
    parsed = new URL(String(input || ""));
  } catch {
    throw new RemoteUrlPolicyError("URL 格式无效");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new RemoteUrlPolicyError("仅允许访问 HTTP(S) 网页");
  }
  if (parsed.username || parsed.password) {
    throw new RemoteUrlPolicyError("URL 不得包含登录凭据");
  }

  const hostname = normalizeHost(parsed.hostname);
  if (!hostname) throw new RemoteUrlPolicyError("URL 缺少有效域名");
  if (hostname === "localhost" || BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new RemoteUrlPolicyError("不允许访问本机或内部网络地址");
  }
  if (looksLikeIpAddress(hostname) && !isPublicIpAddress(hostname)) {
    throw new RemoteUrlPolicyError("不允许访问私网、链路本地或保留地址");
  }

  parsed.hash = "";
  return parsed;
}
