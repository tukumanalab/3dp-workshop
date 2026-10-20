import { cookies } from "next/headers";
import { prisma } from "./db";
import type { Viewer } from "./access";
import { PARTICIPANT_COOKIE_PREFIX, USER_COOKIE, parseCookieHeader, verifyToken } from "./session";

type Jar = Record<string, string>;

/** cookie マップから閲覧者を復元する。DB で凍結・削除を確認する。 */
export async function viewerFromJar(jar: Jar): Promise<Viewer> {
  const viewer: Viewer = { participants: [] };
  const ut = await verifyToken<{ uid?: number }>(jar[USER_COOKIE]);
  if (ut && typeof ut.uid === "number") {
    const user = await prisma.user.findUnique({ where: { id: ut.uid }, select: { id: true, role: true, status: true } });
    if (user && user.status === "APPROVED") viewer.user = { userId: user.id, role: user.role };
  }
  for (const [name, value] of Object.entries(jar)) {
    if (!name.startsWith(PARTICIPANT_COOKIE_PREFIX)) continue;
    const t = await verifyToken<{ pid?: number; wid?: number }>(value);
    if (!t || typeof t.pid !== "number" || typeof t.wid !== "number") continue;
    const p = await prisma.participant.findUnique({ where: { id: t.pid }, select: { id: true, workshopId: true, deletedAt: true } });
    if (p && !p.deletedAt && p.workshopId === t.wid) viewer.participants!.push({ participantId: p.id, workshopId: p.workshopId });
  }
  return viewer;
}

export function viewerFromRequest(req: Request): Promise<Viewer> {
  return viewerFromJar(parseCookieHeader(req.headers.get("cookie")));
}

/** Server Component 用 */
export async function currentViewer(): Promise<Viewer> {
  const store = await cookies();
  const jar: Jar = {};
  for (const c of store.getAll()) jar[c.name] = c.value;
  return viewerFromJar(jar);
}
