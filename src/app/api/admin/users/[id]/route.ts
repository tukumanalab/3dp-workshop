import { NextResponse } from "next/server";
import { isUserRole, isUserStatus } from "@/lib/access";
import { requireSiteAdmin, wouldRemoveLastAdmin } from "@/lib/adminGuard";
import { isValidEmail, serializeAdminUser } from "@/lib/adminUsers";
import { prisma } from "@/lib/db";
import { jsonError, notFound, readJson } from "@/lib/http";
import { S } from "@/lib/strings";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const parseId = (s: string) => (/^\d+$/.test(s) ? Number(s) : null);

export async function PATCH(req: Request, { params }: Ctx) {
  const g = await requireSiteAdmin(req);
  if ("response" in g) return g.response;
  const id = parseId((await params).id);
  const target = id === null ? null : await prisma.user.findUnique({ where: { id } });
  if (!target) return notFound();
  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return jsonError("リクエストが不正です", 400);

  const data: { role?: string; status?: string; name?: string; email?: string } = {};
  if (body.role !== undefined) {
    if (!isUserRole(body.role)) return jsonError(S.siteAdmin.errors.invalidRole, 400);
    if (body.role !== target.role) data.role = body.role;
  }
  if (body.status !== undefined) {
    if (!isUserStatus(body.status)) return jsonError(S.siteAdmin.errors.invalidStatus, 400);
    if (body.status !== target.status) data.status = body.status;
  }
  if (body.name !== undefined) {
    const n = typeof body.name === "string" ? body.name.trim() : "";
    if (!n || n.length > 100) return jsonError(S.siteAdmin.errors.invalidName, 400);
    data.name = n;
  }
  if (body.email !== undefined) {
    const e = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!isValidEmail(e)) return jsonError(S.siteAdmin.errors.invalidEmail, 400);
    if (e !== target.email) {
      if (await prisma.user.findUnique({ where: { email: e } })) return jsonError(S.siteAdmin.errors.emailTaken, 409);
      data.email = e;
    }
  }

  const changesAccess = data.role !== undefined || data.status !== undefined;
  if (changesAccess && target.id === g.viewer.user!.userId) return jsonError(S.siteAdmin.errors.self, 400);
  const losesAdmin = data.role === "organizer" || data.status === "SUSPENDED";
  if (losesAdmin && (await wouldRemoveLastAdmin(target))) return jsonError(S.siteAdmin.errors.lastAdmin, 409);

  const updated = await prisma.user.update({
    where: { id: target.id },
    data,
    include: { _count: { select: { workshops: true, projects: true } } },
  });
  return NextResponse.json({ user: serializeAdminUser(updated) });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const g = await requireSiteAdmin(req);
  if ("response" in g) return g.response;
  const id = parseId((await params).id);
  const target = id === null ? null : await prisma.user.findUnique({ where: { id } });
  if (!target) return notFound();
  if (target.id === g.viewer.user!.userId) return jsonError(S.siteAdmin.errors.selfDelete, 400);
  if (await wouldRemoveLastAdmin(target)) return jsonError(S.siteAdmin.errors.lastAdmin, 409);
  if ((await prisma.workshop.count({ where: { ownerId: target.id } })) > 0) return jsonError(S.siteAdmin.errors.hasOwned, 409);
  if ((await prisma.project.count({ where: { userId: target.id } })) > 0) return jsonError(S.siteAdmin.errors.hasProjects, 409);
  await prisma.user.delete({ where: { id: target.id } });
  return NextResponse.json({ ok: true });
}
