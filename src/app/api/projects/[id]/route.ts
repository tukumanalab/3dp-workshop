import { NextResponse } from "next/server";
import { canEditProject, canManageProject, canSetProjectStatus, canSetTeachingMaterial, canViewProject } from "@/lib/access";
import { isProjectVisible, loadProjectContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { forbidden, jsonError, notFound, readJson } from "@/lib/http";
import { deleteProject } from "@/lib/projects";
import { thumbnailUrl } from "@/lib/gallery";
import { listStatusLabels, resolveProjectStatuses, resolveStatusSelection, setProjectStatuses } from "@/lib/statuses";
import { viewerFromRequest } from "@/lib/viewer";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const viewer = await viewerFromRequest(req);
  const ctx = await loadProjectContext(id);
  if (!ctx || !isProjectVisible(ctx, viewer)) return notFound();
  const p = ctx.project;
  const full = await prisma.project.findUniqueOrThrow({
    where: { id: p.id },
    include: { participant: { select: { displayName: true } }, user: { select: { name: true } }, statuses: { select: { optionId: true } } },
  });
  let remixOf: { id: string; title: string; authorName: string; viewable: boolean } | null = null;
  if (p.isRemixOfUid) {
    const parent = await loadProjectContext(p.isRemixOfUid);
    if (parent && canViewProject(ctx.workshop, parent.session, parent.project, viewer)) {
      const pf = await prisma.project.findUniqueOrThrow({
        where: { id: parent.project.id },
        include: { participant: { select: { displayName: true } }, user: { select: { name: true } } },
      });
      remixOf = { id: parent.project.uid, title: parent.project.title, authorName: pf.participant?.displayName ?? pf.user?.name ?? "", viewable: true };
    } else {
      remixOf = { id: p.isRemixOfUid, title: "", authorName: "", viewable: false };
    }
  }
  return NextResponse.json({
    project: {
      id: p.uid,
      title: p.title,
      description: p.description,
      isShared: p.isShared,
      isTeachingMaterial: p.isTeachingMaterial,
      sessionId: p.sessionId,
      workshopSlug: ctx.workshop.slug,
      authorName: full.participant?.displayName ?? full.user?.name ?? "（不明）",
      thumbnailUrl: p.hasThumbnail ? thumbnailUrl(p.uid, p.headVersionTs) : null,
      sizeBytes: p.sizeBytes,
      updatedAt: p.updatedAt,
      createdAt: p.createdAt,
      remixOf,
      statuses: resolveProjectStatuses(await listStatusLabels(ctx.workshop.id), full.statuses),
      canEdit: canEditProject(ctx.workshop, p, viewer),
      canManage: canManageProject(ctx.workshop, p, viewer),
    },
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const viewer = await viewerFromRequest(req);
  const ctx = await loadProjectContext(id);
  if (!ctx || !isProjectVisible(ctx, viewer)) return notFound();
  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return jsonError("リクエストが不正です", 400);
  // 共有切替と状態は作者か staff（状態は受付終了中も可）、教材指定は staff、それ以外（タイトル等）は作者のみ。キーごとに必要な権限を全て満たすこと。
  const keys = Object.keys(body);
  for (const key of keys) {
    const allowed =
      key === "isShared"
        ? canManageProject(ctx.workshop, ctx.project, viewer)
        : key === "isTeachingMaterial"
          ? canSetTeachingMaterial(ctx.workshop, viewer)
          : key === "statuses"
            ? canSetProjectStatus(ctx.workshop, ctx.project, viewer)
            : canEditProject(ctx.workshop, ctx.project, viewer);
    if (!allowed) return forbidden();
  }
  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t || t.length > 200) return jsonError("タイトルが不正です", 400);
    data.title = t;
  }
  if (typeof body.description === "string") data.description = body.description.slice(0, 5000);
  if (typeof body.isShared === "boolean") data.isShared = body.isShared;
  if (typeof body.isTeachingMaterial === "boolean") data.isTeachingMaterial = body.isTeachingMaterial;
  if (body.sessionId !== undefined) {
    const sid = Number(body.sessionId);
    const target = await prisma.session.findFirst({ where: { id: sid || -1, workshopId: ctx.workshop.id } });
    if (!target) return jsonError("セッションが見つかりません", 400);
    data.sessionId = target.id;
  }
  let selection: Parameters<typeof setProjectStatuses>[1] | null = null;
  if (body.statuses !== undefined) {
    const r = resolveStatusSelection(await listStatusLabels(ctx.workshop.id), body.statuses);
    if (!r.ok) return jsonError(r.error, 400);
    selection = r.selection;
  }
  // 状態だけの変更では作品の更新日時を動かさない
  const updated = Object.keys(data).length > 0
    ? await prisma.project.update({ where: { id: ctx.project.id }, data })
    : await prisma.project.findUniqueOrThrow({ where: { id: ctx.project.id } });
  if (selection) await setProjectStatuses(ctx.project.id, selection);
  return NextResponse.json({ project: { id: updated.uid, title: updated.title, description: updated.description, isShared: updated.isShared, isTeachingMaterial: updated.isTeachingMaterial, sessionId: updated.sessionId } });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const viewer = await viewerFromRequest(req);
  const ctx = await loadProjectContext(id);
  if (!ctx || !isProjectVisible(ctx, viewer)) return notFound();
  if (!canManageProject(ctx.workshop, ctx.project, viewer)) return forbidden();
  await deleteProject(ctx.project);
  return NextResponse.json({ ok: true });
}
