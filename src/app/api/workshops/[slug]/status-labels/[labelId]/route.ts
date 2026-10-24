import { NextResponse } from "next/server";
import { canManageStatusLabels, canViewWorkshop } from "@/lib/access";
import { loadWorkshopBySlug } from "@/lib/context";
import { prisma } from "@/lib/db";
import { forbidden, jsonError, notFound, readJson } from "@/lib/http";
import { listStatusLabels, MAX_STATUS_NAME, MAX_STATUS_OPTIONS, normalizeStatusName } from "@/lib/statuses";
import { viewerFromRequest } from "@/lib/viewer";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string; labelId: string }> };

async function load(req: Request, ctx: Ctx) {
  const { slug, labelId } = await ctx.params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return { error: notFound() } as const;
  if (!canManageStatusLabels(w, viewer)) return { error: forbidden() } as const;
  const label = await prisma.statusLabel.findFirst({ where: { id: Number(labelId) || -1, workshopId: w.id }, include: { options: true } });
  if (!label) return { error: notFound() } as const;
  return { w, label } as const;
}

/**
 * PATCH { name?, options?: [{ id?, name }] }
 * options は全置換: id 付きは改名、id なしは追加、並びは配列の順。載っていないオプションは削除し、その状態も外れる。
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const r = await load(req, ctx);
  if (r.error) return r.error;
  const body = await readJson<{ name?: unknown; options?: unknown }>(req);
  if (!body) return jsonError("リクエストが不正です", 400);
  let name: string | undefined;
  if (body.name !== undefined) {
    const n = normalizeStatusName(body.name);
    if (!n) return jsonError(`種類の名前を 1〜${MAX_STATUS_NAME} 文字で入力してください`, 400);
    name = n;
  }
  let options: { id?: number; name: string }[] | undefined;
  if (body.options !== undefined) {
    const raw = Array.isArray(body.options) ? body.options : null;
    if (!raw || raw.length === 0 || raw.length > MAX_STATUS_OPTIONS)
      return jsonError(`状態を 1〜${MAX_STATUS_OPTIONS} 個にしてください`, 400);
    const existing = new Set(r.label.options.map((o) => o.id));
    options = [];
    for (const o of raw as { id?: unknown; name?: unknown }[]) {
      const n = normalizeStatusName(o?.name);
      if (!n) return jsonError(`状態の名前を 1〜${MAX_STATUS_NAME} 文字で入力してください`, 400);
      if (o.id !== undefined && (typeof o.id !== "number" || !existing.has(o.id))) return jsonError("状態が見つかりません", 400);
      options.push({ id: o.id as number | undefined, name: n });
    }
    const ids = options.flatMap((o) => (o.id === undefined ? [] : [o.id]));
    if (new Set(ids).size !== ids.length) return jsonError("状態の指定が重複しています", 400);
    if (new Set(options.map((o) => o.name)).size !== options.length) return jsonError("同じ名前の状態があります", 400);
  }
  const keep = new Set(options?.flatMap((o) => (o.id === undefined ? [] : [o.id])) ?? []);
  await prisma.$transaction([
    ...(name !== undefined ? [prisma.statusLabel.update({ where: { id: r.label.id }, data: { name } })] : []),
    ...(options
      ? [
          prisma.statusOption.deleteMany({ where: { labelId: r.label.id, id: { notIn: [...keep] } } }),
          ...options.map((o, order) =>
            o.id === undefined
              ? prisma.statusOption.create({ data: { labelId: r.label.id, name: o.name, order } })
              : prisma.statusOption.update({ where: { id: o.id }, data: { name: o.name, order } }),
          ),
        ]
      : []),
  ]);
  return NextResponse.json({ label: (await listStatusLabels(r.w.id)).find((l) => l.id === r.label.id) });
}

/** ラベルを消すと、オプションと作品に付いた状態も消える */
export async function DELETE(req: Request, ctx: Ctx) {
  const r = await load(req, ctx);
  if (r.error) return r.error;
  await prisma.statusLabel.delete({ where: { id: r.label.id } });
  return NextResponse.json({ ok: true });
}
