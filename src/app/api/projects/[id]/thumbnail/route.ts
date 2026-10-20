import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isProjectVisible, loadProjectContext } from "@/lib/context";
import { notFound } from "@/lib/http";
import { readThumb } from "@/lib/storage";
import { viewerFromRequest } from "@/lib/viewer";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** 共有作品(閲覧可能)は未ログインでも取得可。可視性は他と同じ canView で判定。 */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const viewer = await viewerFromRequest(req);
  const ctx = await loadProjectContext(id);
  if (!ctx || !isProjectVisible(ctx, viewer) || !ctx.project.headVersionTs || !ctx.project.hasThumbnail) return notFound();
  // 最新版にサムネが無い場合は遡って探す
  const v = await prisma.projectVersion.findFirst({
    where: { projectId: ctx.project.id, hasThumbnail: true },
    orderBy: { id: "desc" },
  });
  if (!v) return notFound();
  const bytes = await readThumb(ctx.project.uid, v.timestamp);
  if (!bytes) return notFound();
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": "image/png",
      "cache-control": ctx.project.isShared ? "public, max-age=300" : "private, max-age=60",
    },
  });
}
