import { NextResponse } from "next/server";
import { canEditProject } from "@/lib/access";
import { loadProjectContext, isProjectVisible } from "@/lib/context";
import { LYL_MEDIA_TYPE } from "@/lib/lyl";
import { forbidden, jsonError, notFound, unauthorized } from "@/lib/http";
import { StoreError, parseUpload, saveProjectContent } from "@/lib/projects";
import { readLyl } from "@/lib/storage";
import { viewerFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const viewer = await viewerFromRequest(req);
  const ctx = await loadProjectContext(id);
  if (!ctx || !isProjectVisible(ctx, viewer) || !ctx.project.headVersionTs) return notFound();
  const bytes = await readLyl(ctx.project.uid, ctx.project.headVersionTs);
  if (!bytes) return notFound();
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": LYL_MEDIA_TYPE,
      "content-length": String(bytes.length),
      "cache-control": "private, no-store",
      "x-version-timestamp": ctx.project.headVersionTs,
    },
  });
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const viewer = await viewerFromRequest(req);
  const ctx = await loadProjectContext(id);
  if (!ctx || !isProjectVisible(ctx, viewer)) return notFound();
  if (!viewer.user && !viewer.participants?.length) return unauthorized();
  if (!canEditProject(ctx.workshop, ctx.project, viewer)) return forbidden();
  try {
    const upload = await parseUpload(req);
    const result = await saveProjectContent(ctx.project, upload);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof StoreError) return jsonError(e.message, e.status);
    console.error(e);
    return jsonError("保存に失敗しました", 500);
  }
}
