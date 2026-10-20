import { NextResponse } from "next/server";
import { isWorkshopVisibility } from "@/lib/access";
import { prisma } from "@/lib/db";
import { forbidden, jsonError, readJson, unauthorized } from "@/lib/http";
import { createWorkshop, serializeWorkshop, validateSlug } from "@/lib/workshops";
import { viewerFromRequest } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const viewer = await viewerFromRequest(req);
  const mine = new URL(req.url).searchParams.get("mine") === "1";
  const where = mine
    ? viewer.user
      ? { OR: [{ ownerId: viewer.user.userId }, { staff: { some: { userId: viewer.user.userId } } }] }
      : { id: -1 }
    : { visibility: "PUBLIC" };
  const list = await prisma.workshop.findMany({ where, include: { staff: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ workshops: list.map((w) => serializeWorkshop(w, viewer)) });
}

export async function POST(req: Request) {
  const viewer = await viewerFromRequest(req);
  if (!viewer.user) return unauthorized();
  const body = await readJson<{ slug?: string; title?: string; description?: string; visibility?: string }>(req);
  if (!body) return jsonError("リクエストが不正です", 400);
  const slug = validateSlug(body.slug);
  if (!slug) return jsonError("URL 名は英小文字・数字・ハイフンの 3〜40 文字で指定してください", 400);
  const title = (body.title ?? "").trim();
  if (!title || title.length > 100) return jsonError("タイトルを 1〜100 文字で入力してください", 400);
  if (body.visibility !== undefined && !isWorkshopVisibility(body.visibility)) return jsonError("公開範囲が不正です", 400);
  if (await prisma.workshop.findUnique({ where: { slug } })) return jsonError("この URL 名は既に使われています", 409);
  const user = await prisma.user.findUnique({ where: { id: viewer.user.userId } });
  if (!user || user.status !== "APPROVED") return forbidden();
  const w = await createWorkshop({
    ownerId: user.id,
    slug,
    title,
    description: (body.description ?? "").slice(0, 2000),
    visibility: body.visibility,
  });
  const full = await prisma.workshop.findUniqueOrThrow({ where: { id: w.id }, include: { staff: true } });
  return NextResponse.json({ workshop: serializeWorkshop(full, viewer) }, { status: 201 });
}
