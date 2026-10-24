import { sha256Hex } from "./crypto";
import { prisma } from "./db";
import { canViewProject, canViewSession, isAuthor, isWorkshopStaff, type Viewer, type WorkshopForAccess } from "./access";
import { listStatusLabels, resolveProjectStatuses, type ProjectStatusView } from "./statuses";

export type ProjectCard = {
  id: string;
  title: string;
  description: string;
  sessionId: number;
  sessionName: string;
  /** 作者の識別子（`p:<participantId>` / `u:<userId>`）。同名の別人を区別するために使う。 */
  authorKey: string;
  authorName: string;
  isShared: boolean;
  isTeachingMaterial: boolean;
  mine: boolean;
  thumbnailUrl: string | null;
  updatedAt: Date;
  isRemixOfUid: string | null;
  /** 付いている状態（ラベル順） */
  statuses: ProjectStatusView[];
};

export const thumbnailUrl = (uid: string, v?: string | null) =>
  `/3dp/api/projects/${uid}/thumbnail${v ? `?v=${v}` : ""}`;

export async function listProjectsForViewer(
  workshop: WorkshopForAccess & { id: number },
  viewer: Viewer,
  opts: { sessionId?: number; mine?: boolean } = {},
): Promise<ProjectCard[] | null> {
  const sessions = await prisma.session.findMany({ where: { workshopId: workshop.id } });
  if (opts.sessionId !== undefined) {
    const s = sessions.find((x) => x.id === opts.sessionId);
    if (!s || !canViewSession(workshop, s, viewer)) return null;
  }
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const labels = await listStatusLabels(workshop.id);
  const rows = await prisma.project.findMany({
    where: { workshopId: workshop.id, ...(opts.sessionId !== undefined ? { sessionId: opts.sessionId } : {}) },
    include: {
      participant: { select: { displayName: true, deletedAt: true } },
      user: { select: { name: true } },
      statuses: { select: { optionId: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const out: ProjectCard[] = [];
  for (const p of rows) {
    const session = sessionMap.get(p.sessionId);
    if (!session || !canViewProject(workshop, session, p, viewer)) continue;
    const mine = isAuthor(workshop, p, viewer);
    if (opts.mine && !mine) continue;
    out.push({
      id: p.uid,
      title: p.title,
      description: p.description,
      sessionId: p.sessionId,
      sessionName: session.name,
      authorKey: p.participantId !== null ? `p:${p.participantId}` : p.userId !== null ? `u:${p.userId}` : "unknown",
      authorName: p.participant?.displayName ?? p.user?.name ?? "（不明）",
      isShared: p.isShared,
      isTeachingMaterial: p.isTeachingMaterial,
      mine,
      thumbnailUrl: p.hasThumbnail ? thumbnailUrl(p.uid, p.headVersionTs) : null,
      updatedAt: p.updatedAt,
      isRemixOfUid: p.isRemixOfUid,
      statuses: resolveProjectStatuses(labels, p.statuses),
    });
  }
  return out;
}

/**
 * 一覧の見え方が変わったかを調べるための値。状態・名前・共有・追加削除のどれでも変わる。
 * 閲覧者に見える作品だけから作るので、見えない作品の変化は漏れない。並び順には左右されない。
 */
export function projectsDigest(cards: ProjectCard[]): string {
  const rows = [...cards]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((c) => [
      c.id,
      c.title,
      c.isShared,
      c.updatedAt.getTime(),
      c.thumbnailUrl,
      c.statuses.map((s) => [s.labelId, s.optionId, s.labelName, s.optionName]),
    ]);
  return sha256Hex(JSON.stringify(rows)).slice(0, 32);
}

// ---- 作品ページの「戻る」で元の一覧に戻すための back クエリ ----
// 作品へのリンクに `?back=<一覧の条件>` を付け、作品ページで検証してから行き先に使う。
// ギャラリーは `session` / `q` / `sort` / `status`、参加者別は `view=people` と `sort` / `author`。

const BACK_KEYS = ["view", "author", "session", "q", "sort", "status"] as const;
const AUTHOR_KEY = /^[pu]:\d{1,9}$/;

/** 参加者別画面で、作者ごとの見出しに付ける id（戻ったときにその人の作品へスクロールする） */
export const authorAnchor = (authorKey: string) => `author-${authorKey.replace(":", "-")}`;

/**
 * 一覧の条件から、戻り先に必要なキーだけを残した文字列。
 * ギャラリーでセッションだけのときは、作品のセッションへ戻るのと同じなので null。
 */
export function galleryBackParam(params: URLSearchParams): string | null {
  if (params.get("view") === "people") {
    const out = new URLSearchParams({ view: "people" });
    if (params.get("sort") === "recent") out.set("sort", "recent");
    const author = params.get("author");
    if (author && AUTHOR_KEY.test(author)) out.set("author", author);
    return out.toString();
  }
  const out = new URLSearchParams();
  for (const k of BACK_KEYS) {
    const v = params.get(k);
    if (v && k !== "view" && k !== "author") out.set(k, v.slice(0, 500));
  }
  if (!out.has("q") && !out.has("sort") && !out.has("status")) return null;
  return out.toString();
}

/** back クエリから戻り先を作る。パスは自分で組むので、外部や別のワークショップには飛ばない。 */
export function galleryBackHref(slug: string, back: string | undefined, fallback: string): string {
  if (!back) return fallback;
  const p = galleryBackParam(new URLSearchParams(back));
  if (!p) return fallback;
  const q = new URLSearchParams(p);
  if (q.get("view") === "people") {
    const sort = q.get("sort");
    const author = q.get("author");
    return `/${slug}/people${sort ? `?sort=${sort}` : ""}${author ? `#${authorAnchor(author)}` : ""}`;
  }
  return `/${slug}?${p}`;
}

/** 作品ページへのリンク（back があれば引き継ぐ） */
export const projectHref = (slug: string, id: string, back?: string | null, path = "") =>
  `/${slug}/projects/${id}${path}${back ? `${path.includes("?") ? "&" : "?"}back=${encodeURIComponent(back)}` : ""}`;

export type ProjectSort = "recent" | "title";

export const parseProjectSort = (v: string | undefined): ProjectSort => (v === "title" ? "title" : "recent");

/** 作品の並び替え（新しい配列を返す）。タイトル順は五十音・数字は数値として比べ、同じタイトルは更新の新しい順。 */
export function sortProjects(cards: ProjectCard[], sort: ProjectSort): ProjectCard[] {
  const byRecent = (a: ProjectCard, b: ProjectCard) => b.updatedAt.getTime() - a.updatedAt.getTime();
  const byTitle = (a: ProjectCard, b: ProjectCard) =>
    a.title.localeCompare(b.title, "ja", { numeric: true }) || byRecent(a, b);
  return [...cards].sort(sort === "title" ? byTitle : byRecent);
}

/** 検索語の正規化。全角半角・大文字小文字・カタカナとひらがなの違いを無視する。 */
export function normalizeSearchText(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** 検索クエリを語に分ける（空白区切り・最大 10 語）。空なら空配列。 */
export const parseSearchQuery = (q: string | undefined): string[] =>
  normalizeSearchText(q ?? "").split(/\s+/).filter(Boolean).slice(0, 10);

/** タイトル・作者名・説明のどれかに、すべての語が含まれる作品だけを返す（AND 検索）。 */
export function searchProjects(cards: ProjectCard[], terms: string[]): ProjectCard[] {
  if (terms.length === 0) return cards;
  return cards.filter((c) => {
    const text = normalizeSearchText(`${c.title}\n${c.authorName}\n${c.description}`);
    return terms.every((t) => text.includes(t));
  });
}

export type AuthorSort = "name" | "recent";
export type AuthorGroup = { key: string; name: string; latest: Date; projects: ProjectCard[] };

/** 作品を作者ごとにまとめる。各人の作品は更新日時の新しい順。作者の並びは名前順か、最新更新の新しい順。 */
export function groupProjectsByAuthor(cards: ProjectCard[], sort: AuthorSort): AuthorGroup[] {
  const map = new Map<string, AuthorGroup>();
  for (const c of cards) {
    const g = map.get(c.authorKey);
    if (g) g.projects.push(c);
    else map.set(c.authorKey, { key: c.authorKey, name: c.authorName, latest: c.updatedAt, projects: [c] });
  }
  const groups = [...map.values()];
  for (const g of groups) {
    g.projects.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    g.latest = g.projects[0].updatedAt;
  }
  const byRecent = (a: AuthorGroup, b: AuthorGroup) => b.latest.getTime() - a.latest.getTime();
  return groups.sort(sort === "recent" ? byRecent : (a, b) => a.name.localeCompare(b.name, "ja") || byRecent(a, b));
}

export { isWorkshopStaff };
