/**
 * 参加者のログイン ID をこのブラウザ（localStorage）に記録する。PIN は保存しない。
 * 教室の共用端末を想定し、ワークショップごとに新しい順で数件まで持つ。
 */
export type SavedLogin = { loginId: string; displayName: string; hasPin: boolean; savedAt: number };

const KEY = "3dp-workshop.logins";
const MAX_PER_WORKSHOP = 5;

function readAll(): Record<string, SavedLogin[]> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, SavedLogin[]>) : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, SavedLogin[]>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}

function isSavedLogin(v: unknown): v is SavedLogin {
  const o = v as SavedLogin | null;
  return !!o && typeof o.loginId === "string" && o.loginId !== "" && typeof o.displayName === "string";
}

export function loadSavedLogins(slug: string): SavedLogin[] {
  const list = readAll()[slug];
  if (!Array.isArray(list)) return [];
  return list
    .filter(isSavedLogin)
    .map((l) => ({ ...l, hasPin: !!l.hasPin, savedAt: Number(l.savedAt) || 0 }))
    .sort((a, b) => b.savedAt - a.savedAt);
}

export function rememberLogin(slug: string, entry: Omit<SavedLogin, "savedAt">): SavedLogin[] {
  const all = readAll();
  const rest = loadSavedLogins(slug).filter((l) => l.loginId !== entry.loginId);
  const list = [{ ...entry, savedAt: Date.now() }, ...rest].slice(0, MAX_PER_WORKSHOP);
  writeAll({ ...all, [slug]: list });
  return list;
}

export function forgetLogin(slug: string, loginId: string): SavedLogin[] {
  const all = readAll();
  const list = loadSavedLogins(slug).filter((l) => l.loginId !== loginId);
  if (list.length) all[slug] = list;
  else delete all[slug];
  writeAll(all);
  return list;
}
