import path from "path";

const isProd = () => process.env.NODE_ENV === "production";

function intEnv(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

/** 毎回読むことで、テストで env を差し替えられるようにする。 */
export const config = {
  get basePath() {
    return "/3dp-workshop";
  },
  get appOrigin() {
    return (process.env.APP_ORIGIN || "http://localhost:3010").replace(/\/+$/, "");
  },
  get storageDir() {
    return path.resolve(process.env.STORAGE_DIR || "./data/storage");
  },
  get sessionSecret() {
    const s = process.env.SESSION_SECRET || "";
    if (s.length >= 32) return s;
    if (isProd()) throw new Error("SESSION_SECRET must be set (32+ chars)");
    return "dev-only-insecure-secret-change-me-0000000000";
  },
  get maxProjectBytes() {
    return intEnv("MAX_PROJECT_BYTES", 50 * 1024 * 1024);
  },
  get maxThumbnailBytes() {
    return intEnv("MAX_THUMBNAIL_BYTES", 5 * 1024 * 1024);
  },
  get keepVersions() {
    return intEnv("KEEP_VERSIONS", 20);
  },
  get passwordLoginEnabled() {
    const v = process.env.PASSWORD_LOGIN_ENABLED;
    if (v === undefined || v === "") return !isProd();
    return v === "true" || v === "1";
  },
  get googleClientId() {
    return process.env.GOOGLE_CLIENT_ID || "";
  },
  get googleClientSecret() {
    return process.env.GOOGLE_CLIENT_SECRET || "";
  },
  get allowedEmailDomains() {
    return (process.env.ALLOWED_EMAIL_DOMAINS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  },
  get editorBaseUrl() {
    return process.env.EDITOR_BASE_URL || "/3dp-workshop/editor/";
  },
  get isProd() {
    return isProd();
  },
};
