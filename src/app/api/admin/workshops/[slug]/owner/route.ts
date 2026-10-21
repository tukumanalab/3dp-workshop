import { NextResponse } from "next/server";
import { requireSiteAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/db";
import { jsonError, notFound, readJson } from "@/lib/http";
import { S } from "@/lib/strings";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const g = await requireSiteAdmin(req);
  if ("response" in g) return g.response;
  const { slug } = await params;
  const w = await prisma.workshop.findUnique({ where: { slug } });
  if (!w) return notFound();
  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return jsonError("リクエストが不正です", 400);

  let target = null;
  if (typeof body.userId === "number") target = await prisma.user.findUnique({ where: { id: body.userId } });
  else if (typeof body.email === "string") target = await prisma.user.findUnique({ where: { email: body.email.trim().toLowerCase() } });
  if (!target) return jsonError(S.siteAdmin.errors.ownerTarget, 404);
  if (target.status !== "APPROVED") return jsonError(S.siteAdmin.errors.ownerSuspended, 409);
  if (target.id === w.ownerId) return jsonError(S.siteAdmin.errors.ownerSame, 409);

  const keep = body.keepPreviousOwnerAsStaff === true;
  const previousOwnerId = w.ownerId;
  await prisma.$transaction(async (tx) => {
    await tx.workshopStaff.deleteMany({ where: { workshopId: w.id, userId: target.id } });
    await tx.workshop.update({ where: { id: w.id }, data: { ownerId: target.id } });
    if (keep) await tx.workshopStaff.create({ data: { workshopId: w.id, userId: previousOwnerId } });
  });
  return NextResponse.json({ ok: true, ownerId: target.id });
}
