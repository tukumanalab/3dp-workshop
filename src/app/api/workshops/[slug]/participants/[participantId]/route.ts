import { NextResponse } from "next/server";
import { canViewWorkshop, isWorkshopStaff } from "@/lib/access";
import { loadWorkshopBySlug } from "@/lib/context";
import { prisma } from "@/lib/db";
import { hashSecret, newPin } from "@/lib/crypto";
import { forbidden, jsonError, notFound, readJson } from "@/lib/http";
import { viewerFromRequest } from "@/lib/viewer";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string; participantId: string }> };

async function load(req: Request, ctx: Ctx) {
  const { slug, participantId } = await ctx.params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return { error: notFound() } as const;
  if (!isWorkshopStaff(w, viewer)) return { error: forbidden() } as const;
  const p = await prisma.participant.findFirst({ where: { id: Number(participantId) || -1, workshopId: w.id, deletedAt: null } });
  if (!p) return { error: notFound() } as const;
  return { p } as const;
}

/** PATCH { resetPin: true } → 新しい PIN を発行して一度だけ返す。{ displayName } で改名。 */
export async function PATCH(req: Request, ctx: Ctx) {
  const r = await load(req, ctx);
  if ("error" in r) return r.error;
  const body = await readJson<{ resetPin?: boolean; displayName?: string; clearPin?: boolean }>(req);
  if (!body) return jsonError("リクエストが不正です", 400);
  const data: { pinHash?: string | null; displayName?: string } = {};
  let pin: string | undefined;
  if (body.resetPin) {
    pin = newPin();
    data.pinHash = hashSecret(pin);
  } else if (body.clearPin) {
    data.pinHash = null;
  }
  if (typeof body.displayName === "string") {
    const n = body.displayName.trim();
    if (!n || n.length > 40) return jsonError("表示名が不正です", 400);
    data.displayName = n;
  }
  await prisma.participant.update({ where: { id: r.p.id }, data });
  return NextResponse.json({ ok: true, pin });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const r = await load(req, ctx);
  if ("error" in r) return r.error;
  await prisma.participant.update({ where: { id: r.p.id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
