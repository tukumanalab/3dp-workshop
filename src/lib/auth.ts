import { Google } from "arctic";
import { config } from "./env";

export function googleClient() {
  if (!config.googleClientId || !config.googleClientSecret) return null;
  return new Google(config.googleClientId, config.googleClientSecret, `${config.appOrigin}${config.basePath}/api/auth/google/callback`);
}

export function emailAllowed(email: string): boolean {
  const domains = config.allowedEmailDomains;
  if (domains.length === 0) return true;
  const d = email.split("@")[1]?.toLowerCase() ?? "";
  return domains.includes(d);
}

/** リダイレクト先は同一サイト内パスのみ許可（オープンリダイレクト対策）。 */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
