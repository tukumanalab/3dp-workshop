import { NextResponse } from "next/server";
import { canManageStaff, canViewWorkshop, isWorkshopStaff } from "@/lib/access";
import { loadWorkshopBySlug } from "@/lib/context";
import { forbidden, jsonError, notFound, readJson } from "@/lib/http";
import { S } from "@/lib/strings";
import { viewerFromRequest } from "@/lib/viewer";
import { addStaff, findUserByIdOrEmail, listStaff } from "@/lib/workshopStaff";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return notFound();
  if (!isWorkshopStaff(w, viewer)) return forbidden();
  return NextResponse.json({ ownerId: w.ownerId, staff: await listStaff(w.id) });
}

/** POST { email } | { userId } → 共同運営者に追加（オーナーのみ） */
export async function POST(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return notFound();
  if (!canManageStaff(w, viewer)) return forbidden();
  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return jsonError("リクエストが不正です", 400);
  const target = await findUserByIdOrEmail(body);
  if (!target) return jsonError(S.admin.staff.errors.notFound, 404);
  if (target.status !== "APPROVED") return jsonError(S.admin.staff.errors.suspended, 409);
  if ((await addStaff(w, target.id)) === "exists") return jsonError(S.admin.staff.errors.exists, 409);
  return NextResponse.json({ ok: true, userId: target.id });
}
