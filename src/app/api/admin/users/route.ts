import { NextResponse } from "next/server";
import { isUserRole, isUserStatus } from "@/lib/access";
import { requireSiteAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/db";
import { jsonError, readJson } from "@/lib/http";
import { S } from "@/lib/strings";
import { isValidEmail, serializeAdminUser } from "@/lib/adminUsers";

export const dynamic = "force-dynamic";

const PAGE_SIZE_MAX = 100;

export async function GET(req: Request) {
  const g = await requireSiteAdmin(req);
  if ("response" in g) return g.response;
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  const role = sp.get("role");
  const status = sp.get("status");
  const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number.parseInt(sp.get("pageSize") ?? "50", 10) || 50));
  const where = {
    ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
    ...(isUserRole(role) ? { role } : {}),
    ...(isUserStatus(status) ? { status } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { id: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { workshops: true, projects: true } } },
    }),
  ]);
  return NextResponse.json({ users: rows.map(serializeAdminUser), total, page, pageSize });
}

/** 事前登録。本人が同じメールで Google ログインすると、既存の callback 処理で紐付く。 */
export async function POST(req: Request) {
  const g = await requireSiteAdmin(req);
  if ("response" in g) return g.response;
  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return jsonError("リクエストが不正です", 400);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!isValidEmail(email)) return jsonError(S.siteAdmin.errors.invalidEmail, 400);
  if (!name || name.length > 100) return jsonError(S.siteAdmin.errors.invalidName, 400);
  const role = body.role === undefined ? "organizer" : body.role;
  if (!isUserRole(role)) return jsonError(S.siteAdmin.errors.invalidRole, 400);
  if (await prisma.user.findUnique({ where: { email } })) return jsonError(S.siteAdmin.errors.emailTaken, 409);
  const user = await prisma.user.create({
    data: { email, name, role, status: "APPROVED", passwordHash: null },
    include: { _count: { select: { workshops: true, projects: true } } },
  });
  return NextResponse.json({ user: serializeAdminUser(user) }, { status: 201 });
}
