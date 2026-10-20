import { NextResponse } from "next/server";
import { canCreateProject, canViewWorkshop, participantIdFor, isWorkshopStaff } from "@/lib/access";
import { isProjectVisible, loadProjectContext, loadWorkshopBySlug } from "@/lib/context";
import { prisma } from "@/lib/db";
import { forbidden, jsonError, notFound, unauthorized } from "@/lib/http";
import { StoreError, createProject, parseUpload } from "@/lib/projects";
import { viewerFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const viewer = await viewerFromRequest(req);
  const workshop = await loadWorkshopBySlug(slug);
  if (!workshop || !canViewWorkshop(workshop, viewer)) return notFound();
  if (!viewer.user && !viewer.participants?.length) return unauthorized();
  if (!canCreateProject(workshop, viewer)) return forbidden();

  const url = new URL(req.url);
  const originalId = url.searchParams.get("originalId") || url.searchParams.get("original_id");
  let sessionId = Number(url.searchParams.get("sessionId") || "");
  let remixOfUid: string | null = null;

  if (originalId) {
    const parent = await loadProjectContext(originalId);
    if (parent && parent.project.workshopId === workshop.id && isProjectVisible(parent, viewer)) {
      remixOfUid = parent.project.uid;
      sessionId = parent.project.sessionId; // 親のセッションに置く
    }
  }

  const sessions = await prisma.session.findMany({ where: { workshopId: workshop.id }, orderBy: [{ order: "asc" }, { id: "asc" }] });
  const session = sessions.find((s) => s.id === sessionId) ?? (Number.isFinite(sessionId) && sessionId ? null : sessions[0]);
  if (!session) return jsonError("セッションが見つかりません", 400);

  try {
    const upload = await parseUpload(req);
    const title = (url.searchParams.get("title") || "").trim() || upload.projectName;
    const participantId = participantIdFor(workshop, viewer);
    // 参加者として入っていれば参加者名義、それ以外(staff)はユーザー名義
    const asUser = participantId === null && isWorkshopStaff(workshop, viewer);
    const result = await createProject({
      workshopId: workshop.id,
      sessionId: session.id,
      participantId: asUser ? null : participantId,
      userId: asUser ? viewer.user!.userId : null,
      title,
      isShared: session.defaultShared,
      isRemixOfUid: remixOfUid,
      upload,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof StoreError) return jsonError(e.message, e.status);
    console.error(e);
    return jsonError("保存に失敗しました", 500);
  }
}
