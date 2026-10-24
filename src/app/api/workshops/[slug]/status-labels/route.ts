import { NextResponse } from "next/server";
import { canManageStatusLabels, canViewWorkshop } from "@/lib/access";
import { loadWorkshopBySlug } from "@/lib/context";
import { prisma } from "@/lib/db";
import { forbidden, jsonError, notFound, readJson } from "@/lib/http";
import { listStatusLabels, MAX_STATUS_LABELS, MAX_STATUS_NAME, MAX_STATUS_OPTIONS, normalizeStatusName } from "@/lib/statuses";
import { viewerFromRequest } from "@/lib/viewer";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return notFound();
  return NextResponse.json({ labels: await listStatusLabels(w.id) });
}

/** POST { name, options: string[] } → ラベルとオプションを作る */
export async function POST(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return notFound();
  if (!canManageStatusLabels(w, viewer)) return forbidden();
  const body = await readJson<{ name?: unknown; options?: unknown }>(req);
  const name = normalizeStatusName(body?.name);
  if (!name) return jsonError(`種類の名前を 1〜${MAX_STATUS_NAME} 文字で入力してください`, 400);
  const options = Array.isArray(body?.options) ? body.options.map(normalizeStatusName) : null;
  if (!options || options.length === 0 || options.length > MAX_STATUS_OPTIONS || options.some((o) => o === null))
    return jsonError(`状態を 1〜${MAX_STATUS_OPTIONS} 個、各 1〜${MAX_STATUS_NAME} 文字で入力してください`, 400);
  if (new Set(options).size !== options.length) return jsonError("同じ名前の状態があります", 400);
  const count = await prisma.statusLabel.count({ where: { workshopId: w.id } });
  if (count >= MAX_STATUS_LABELS) return jsonError(`状態の種類は ${MAX_STATUS_LABELS} 個までです`, 409);
  const max = await prisma.statusLabel.aggregate({ where: { workshopId: w.id }, _max: { order: true } });
  const label = await prisma.statusLabel.create({
    data: {
      workshopId: w.id,
      name,
      order: (max._max.order ?? -1) + 1,
      options: { create: (options as string[]).map((n, order) => ({ name: n, order })) },
    },
  });
  return NextResponse.json({ label: (await listStatusLabels(w.id)).find((l) => l.id === label.id) }, { status: 201 });
}
