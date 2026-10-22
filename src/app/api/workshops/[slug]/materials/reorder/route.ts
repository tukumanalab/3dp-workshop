import { NextResponse } from "next/server";
import { canViewWorkshop, isWorkshopStaff } from "@/lib/access";
import { loadWorkshopBySlug } from "@/lib/context";
import { forbidden, jsonError, notFound, readJson } from "@/lib/http";
import { reorderMaterials } from "@/lib/materials";
import { viewerFromRequest } from "@/lib/viewer";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

/** PATCH { sessionId: number | null, ids: [...] } → その対象（全体 or セッション）の資料を ids の順に並べ替える */
export async function PATCH(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return notFound();
  if (!isWorkshopStaff(w, viewer)) return forbidden();
  const body = await readJson<{ sessionId?: unknown; ids?: unknown }>(req);
  const sessionId = body?.sessionId === null ? null : typeof body?.sessionId === "number" ? body.sessionId : undefined;
  if (sessionId === undefined || !Array.isArray(body?.ids)) return jsonError("リクエストが不正です", 400);
  if (!(await reorderMaterials(w.id, sessionId, body.ids))) return jsonError("資料の並びが不正です", 400);
  return NextResponse.json({ ok: true });
}
