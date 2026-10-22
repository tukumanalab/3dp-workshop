import { prisma } from "./db";

export type StaffTarget = { id: number; status: string };

/** userId かメールアドレスから、共同運営者・主催者の候補になる User を探す。 */
export async function findUserByIdOrEmail(body: { userId?: unknown; email?: unknown }) {
  if (typeof body.userId === "number") return prisma.user.findUnique({ where: { id: body.userId } });
  if (typeof body.email === "string" && body.email.trim()) {
    return prisma.user.findUnique({ where: { email: body.email.trim().toLowerCase() } });
  }
  return null;
}

export async function listStaff(workshopId: number) {
  const rows = await prisma.workshopStaff.findMany({
    where: { workshopId },
    orderBy: { id: "asc" },
    include: { user: { select: { id: true, name: true, email: true, status: true } } },
  });
  return rows.map((r) => ({ userId: r.user.id, name: r.user.name, email: r.user.email, status: r.user.status }));
}

/** 既に owner / staff なら "exists" を返す。 */
export async function addStaff(w: { id: number; ownerId: number }, userId: number): Promise<"ok" | "exists"> {
  if (userId === w.ownerId) return "exists";
  const found = await prisma.workshopStaff.findUnique({ where: { workshopId_userId: { workshopId: w.id, userId } } });
  if (found) return "exists";
  await prisma.workshopStaff.create({ data: { workshopId: w.id, userId } });
  return "ok";
}

export async function removeStaff(workshopId: number, userId: number): Promise<boolean> {
  const r = await prisma.workshopStaff.deleteMany({ where: { workshopId, userId } });
  return r.count > 0;
}

/** 主催者を付け替える。新しい主催者の staff 行は消し、keepPrevious なら元の主催者を staff に残す。 */
export async function transferOwnership(w: { id: number; ownerId: number }, newOwnerId: number, keepPrevious: boolean) {
  const previousOwnerId = w.ownerId;
  await prisma.$transaction(async (tx) => {
    await tx.workshopStaff.deleteMany({ where: { workshopId: w.id, userId: newOwnerId } });
    await tx.workshop.update({ where: { id: w.id }, data: { ownerId: newOwnerId } });
    if (keepPrevious) {
      await tx.workshopStaff.upsert({
        where: { workshopId_userId: { workshopId: w.id, userId: previousOwnerId } },
        create: { workshopId: w.id, userId: previousOwnerId },
        update: {},
      });
    }
  });
}

/** 共同運営者の候補検索。APPROVED のユーザーをメール・名前の部分一致で最大 10 件。 */
export async function searchStaffCandidates(w: { id: number; ownerId: number }, q: string) {
  const existing = await prisma.workshopStaff.findMany({ where: { workshopId: w.id }, select: { userId: true } });
  const exclude = [w.ownerId, ...existing.map((e) => e.userId)];
  return prisma.user.findMany({
    where: {
      status: "APPROVED",
      id: { notIn: exclude },
      OR: [{ email: { contains: q } }, { name: { contains: q } }],
    },
    orderBy: { id: "asc" },
    take: 10,
    select: { id: true, name: true, email: true },
  });
}
