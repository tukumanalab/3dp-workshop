import { NextResponse } from "next/server";
import { canManageStaff, canViewWorkshop } from "@/lib/access";
import { loadWorkshopBySlug } from "@/lib/context";
import { prisma } from "@/lib/db";
import { forbidden, jsonError, notFound, readJson } from "@/lib/http";
import { S } from "@/lib/strings";
import { viewerFromRequest } from "@/lib/viewer";
import { transferOwnership } from "@/lib/workshopStaff";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

/** POST { userId } → 共同運営者に主催者を委譲する（オーナーのみ）。元の主催者は共同運営者として残る。 */
export async function POST(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return notFound();
  if (!canManageStaff(w, viewer)) return forbidden();
  const body = await readJson<{ userId?: unknown }>(req);
  if (!body || typeof body.userId !== "number") return jsonError("リクエストが不正です", 400);
  const targetId = body.userId;
  if (!w.staff.some((s) => s.userId === targetId)) return jsonError(S.admin.staff.errors.transferTarget, 409);
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target || target.status !== "APPROVED") return jsonError(S.admin.staff.errors.suspended, 409);
  await transferOwnership(w, target.id, true);
  return NextResponse.json({ ok: true, ownerId: target.id });
}
