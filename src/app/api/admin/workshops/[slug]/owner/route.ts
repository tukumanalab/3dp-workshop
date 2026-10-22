import { NextResponse } from "next/server";
import { requireSiteAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/db";
import { jsonError, notFound, readJson } from "@/lib/http";
import { S } from "@/lib/strings";
import { findUserByIdOrEmail, transferOwnership } from "@/lib/workshopStaff";

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

  const target = await findUserByIdOrEmail(body);
  if (!target) return jsonError(S.siteAdmin.errors.ownerTarget, 404);
  if (target.status !== "APPROVED") return jsonError(S.siteAdmin.errors.ownerSuspended, 409);
  if (target.id === w.ownerId) return jsonError(S.siteAdmin.errors.ownerSame, 409);

  await transferOwnership(w, target.id, body.keepPreviousOwnerAsStaff === true);
  return NextResponse.json({ ok: true, ownerId: target.id });
}
