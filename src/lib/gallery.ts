import { prisma } from "./db";
import { canViewProject, canViewSession, isAuthor, isWorkshopStaff, type Viewer, type WorkshopForAccess } from "./access";

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
  const rows = await prisma.project.findMany({
    where: { workshopId: workshop.id, ...(opts.sessionId !== undefined ? { sessionId: opts.sessionId } : {}) },
    include: { participant: { select: { displayName: true, deletedAt: true } }, user: { select: { name: true } } },
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
    });
  }
  return out;
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
