import { NextResponse } from "next/server";
import { canViewMaterial } from "@/lib/access";
import { loadWorkshopBySlug } from "@/lib/context";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/http";
import { readMaterial } from "@/lib/storage";
import { viewerFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string; materialId: string }> };

/** 資料ファイルの配信。見えない資料は 404。常に attachment で返し、ブラウザでの実行・表示をさせない。 */
export async function GET(req: Request, { params }: Ctx) {
  const { slug, materialId } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w) return notFound();
  const m = await prisma.material.findFirst({ where: { id: Number(materialId) || -1, workshopId: w.id, type: "FILE" }, include: { session: true } });
  if (!m || !canViewMaterial(w, m.session, m, viewer)) return notFound();
  const bytes = await readMaterial(m.uid);
  if (!bytes) return notFound();
  const name = (m.fileName || "file").replace(/[\r\n"]+/g, "_");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
