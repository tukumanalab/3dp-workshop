import { prisma } from "./db";
import { canViewProject, canViewSession, isAuthor, isWorkshopStaff, type Viewer, type WorkshopForAccess } from "./access";

export type ProjectCard = {
  id: string;
  title: string;
  description: string;
  sessionId: number;
  authorName: string;
  isShared: boolean;
  mine: boolean;
  thumbnailUrl: string | null;
  updatedAt: Date;
  isRemixOfUid: string | null;
};

export const thumbnailUrl = (uid: string, v?: string | null) =>
  `/3dp-workshop/api/projects/${uid}/thumbnail${v ? `?v=${v}` : ""}`;

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
      authorName: p.participant?.displayName ?? p.user?.name ?? "（不明）",
      isShared: p.isShared,
      mine,
      thumbnailUrl: p.hasThumbnail ? thumbnailUrl(p.uid, p.headVersionTs) : null,
      updatedAt: p.updatedAt,
      isRemixOfUid: p.isRemixOfUid,
    });
  }
  return out;
}

export { isWorkshopStaff };
