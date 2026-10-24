import Link from "next/link";
import { Download, GitFork, Pencil, Eye } from "lucide-react";
import { Footer, Topbar } from "@/components/Topbar";
import { ProjectActions } from "@/components/ProjectActions";
import { ProjectCardView } from "@/components/ProjectCard";
import { ProjectStatusEditor } from "@/components/ProjectStatusEditor";
import {
  canCreateProject,
  canEditProject,
  canManageProject,
  canSetProjectStatus,
  canSetTeachingMaterial,
  canViewProject,
} from "@/lib/access";
import { loadProjectContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { galleryBackHref, galleryBackParam, listProjectsForViewer, projectHref, thumbnailUrl } from "@/lib/gallery";
import { loadProjectPage } from "@/lib/pages";
import { listStatusLabels, resolveProjectStatuses } from "@/lib/statuses";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { slug, id } = await params;
  // 開いた元の一覧（状態の絞り込み・検索・並び順）。エディタやリミックスへ移っても引き継ぐ
  const back = galleryBackParam(new URLSearchParams((await searchParams).back ?? ""));
  const { viewer, ctx } = await loadProjectPage(slug, id);
  const { project, workshop } = ctx;
  const full = await prisma.project.findUniqueOrThrow({
    where: { id: project.id },
    include: { participant: { select: { displayName: true } }, user: { select: { name: true } }, statuses: { select: { optionId: true } } },
  });
  const labels = await listStatusLabels(workshop.id);
  const statuses = resolveProjectStatuses(labels, full.statuses);
  const canSetStatus = labels.length > 0 && canSetProjectStatus(workshop, project, viewer);
  const author = full.participant?.displayName ?? full.user?.name ?? "";
  const canEdit = canEditProject(workshop, project, viewer);
  const canManage = canManageProject(workshop, project, viewer);
  const canRemix = canCreateProject(workshop, viewer);

  let parent: { id: string; title: string; viewable: boolean } | null = null;
  if (project.isRemixOfUid) {
    const pc = await loadProjectContext(project.isRemixOfUid);
    parent = pc && canViewProject(workshop, pc.session, pc.project, viewer)
      ? { id: pc.project.uid, title: pc.project.title, viewable: true }
      : { id: project.isRemixOfUid, title: S.project.remixOfHidden, viewable: false };
  }
  const all = (await listProjectsForViewer(workshop, viewer)) ?? [];
  const remixes = all.filter((p) => p.isRemixOfUid === project.uid);
  const sessions = await prisma.session.findMany({ where: { workshopId: workshop.id }, orderBy: { order: "asc" } });

  return (
    <main className={ui.shell}>
      <Topbar center={workshop.title} />
      <div>
        <div className={ui.mainStack}>
          <div className={ui.pageHeader}>
            <div>
              <nav className={ui.breadcrumb} aria-label={S.project.breadcrumb}>
                <Link href={`/${slug}`}>{workshop.title}</Link>
                <span aria-hidden="true">/</span>
                <Link href={`/${slug}?session=${project.sessionId}`}>{ctx.session.name}</Link>
              </nav>
              <h1 className={ui.h1}>{project.title}</h1>
              <span className={ui.subtitle}>
                {S.workshop.by}: {author} · {project.isShared ? S.workshop.shared : S.workshop.private}
                {project.isTeachingMaterial ? ` · ${S.workshop.teaching}` : ""}
              </span>
              {statuses.length > 0 ? (
                <span className="mt-2 flex flex-wrap gap-1" aria-label={S.statuses.title}>
                  {statuses.map((st) => (
                    <span key={st.labelId} className={ui.statusBadge}>
                      {st.labelName}: {st.optionName}
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
            <Link className={ui.secondary} href={galleryBackHref(slug, back ?? undefined, `/${slug}?session=${project.sessionId}`)}>
              {S.common.back}
            </Link>
          </div>
          <div className={ui.detail}>
            <div className={ui.stack}>
              <div className={ui.stageLarge}>
                <span className={ui.stage}>
                  {project.hasThumbnail ? (
                    <img className={ui.thumb} src={thumbnailUrl(project.uid, project.headVersionTs)} alt={project.title} />
                  ) : (
                    <>
                      <span className={ui.emptyMark}>{S.workshop.noSnapshot}</span>
                    </>
                  )}
                </span>
              </div>
              <div className={ui.row}>
                {canEdit ? (
                  <Link className={ui.primary} href={projectHref(slug, project.uid, back, "/editor")}>
                    <Pencil size={16} />
                    <span>{S.project.openEditor}</span>
                  </Link>
                ) : (
                  <Link className={ui.primary} href={projectHref(slug, project.uid, back, "/editor?readonly=1")}>
                    <Eye size={16} />
                    <span>{S.project.view}</span>
                  </Link>
                )}
                {canRemix ? (
                  <Link className={ui.secondary} href={projectHref(slug, project.uid, back, "/editor?mode=remix")}>
                    <GitFork size={16} />
                    <span>{S.project.remix}</span>
                  </Link>
                ) : null}
                <a className={ui.secondary} href={`/3dp/api/projects/${project.uid}/download.lyl`}>
                  <Download size={16} />
                  <span>{S.project.download}</span>
                </a>
              </div>
            </div>
            <div className={ui.stack}>
              {project.description ? <p className="whitespace-pre-wrap">{project.description}</p> : null}
              {!project.isShared ? <p className={ui.muted}>{S.project.notShared}</p> : null}
              {parent ? (
                <p className={ui.muted}>
                  {S.project.remixOf}:{" "}
                  {parent.viewable ? <Link href={projectHref(slug, parent.id, back)}>{parent.title}</Link> : parent.title}
                </p>
              ) : null}
              <p className={ui.muted}>
                {S.project.updated}: {project.updatedAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
              </p>
              {canSetStatus ? (
                <ProjectStatusEditor
                  id={project.uid}
                  slug={slug}
                  labels={labels}
                  selected={Object.fromEntries(statuses.map((st) => [st.labelId, st.optionId]))}
                />
              ) : null}
              {canEdit || canManage ? (
                <ProjectActions
                  id={project.uid}
                  slug={slug}
                  title={project.title}
                  description={project.description}
                  isShared={project.isShared}
                  isTeachingMaterial={project.isTeachingMaterial}
                  sessionId={project.sessionId}
                  sessions={sessions.map((s) => ({ id: s.id, name: s.name }))}
                  canEdit={canEdit}
                  canManage={canManage}
                  canSetTeaching={canSetTeachingMaterial(workshop, viewer)}
                  afterDelete={galleryBackHref(slug, back ?? undefined, `/${slug}`)}
                />
              ) : null}
            </div>
          </div>
          {remixes.length > 0 ? (
            <section className={ui.stack}>
              <h2 className="text-lg font-bold">{S.project.remixes}</h2>
              <div className={ui.grid}>
                {remixes.map((p) => (
                  <ProjectCardView key={p.id} slug={slug} p={p} back={back} />
                ))}
              </div>
            </section>
          ) : null}
          <Footer />
        </div>
      </div>
    </main>
  );
}
