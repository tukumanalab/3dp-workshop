import { NextResponse } from "next/server";
import { isProjectVisible, loadProjectContext } from "@/lib/context";
import { notFound } from "@/lib/http";
import { LYL_MEDIA_TYPE } from "@/lib/lyl";
import { readLyl } from "@/lib/storage";
import { viewerFromRequest } from "@/lib/viewer";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const viewer = await viewerFromRequest(req);
  const ctx = await loadProjectContext(id);
  if (!ctx || !isProjectVisible(ctx, viewer) || !ctx.project.headVersionTs) return notFound();
  const bytes = await readLyl(ctx.project.uid, ctx.project.headVersionTs);
  if (!bytes) return notFound();
  const safe = ctx.project.title.replace(/[^\p{L}\p{N}_ -]+/gu, "_").trim() || "design";
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": LYL_MEDIA_TYPE,
      "content-disposition": `attachment; filename="design.lyl"; filename*=UTF-8''${encodeURIComponent(safe)}.lyl`,
      "cache-control": "private, no-store",
    },
  });
}
