import Link from "next/link";
import { Download, GitFork, Pencil, Eye } from "lucide-react";
import { Footer, Topbar } from "@/components/Topbar";
import { ProjectActions } from "@/components/ProjectActions";
import { ProjectCardView } from "@/components/ProjectCard";
import { canCreateProject, canEditProject, canManageProject, canSetTeachingMaterial, canViewProject } from "@/lib/access";
import { loadProjectContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { listProjectsForViewer, thumbnailUrl } from "@/lib/gallery";
import { loadProjectPage } from "@/lib/pages";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { viewer, ctx } = await loadProjectPage(slug, id);
  const { project, workshop } = ctx;
  const full = await prisma.project.findUniqueOrThrow({
    where: { id: project.id },
    include: { participant: { select: { displayName: true } }, user: { select: { name: true } } },
  });
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
              <h1 className={ui.h1}>{project.title}</h1>
              <span className={ui.subtitle}>
                {S.workshop.by}: {author} · {ctx.session.name} · {project.isShared ? S.workshop.shared : S.workshop.private}
                {project.isTeachingMaterial ? ` · ${S.workshop.teaching}` : ""}
              </span>
            </div>
            <Link className={ui.secondary} href={`/${slug}?session=${project.sessionId}`}>
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
                  <Link className={ui.primary} href={`/${slug}/projects/${project.uid}/editor`}>
                    <Pencil size={16} />
                    <span>{S.project.openEditor}</span>
                  </Link>
                ) : null}
                {canRemix ? (
                  <Link className={canEdit ? ui.secondary : ui.primary} href={`/${slug}/projects/${project.uid}/editor?mode=remix`}>
                    <GitFork size={16} />
                    <span>{S.project.remix}</span>
                  </Link>
                ) : null}
                {!canEdit && !canRemix ? (
                  <Link className={ui.primary} href={`/${slug}/projects/${project.uid}/editor?readonly=1`}>
                    <Eye size={16} />
                    <span>{S.project.view}</span>
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
                  {parent.viewable ? <Link href={`/${slug}/projects/${parent.id}`}>{parent.title}</Link> : parent.title}
                </p>
              ) : null}
              <p className={ui.muted}>
                {S.project.updated}: {project.updatedAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
              </p>
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
                />
              ) : null}
            </div>
          </div>
          {remixes.length > 0 ? (
            <section className={ui.stack}>
              <h2 className="text-lg font-bold">{S.project.remixes}</h2>
              <div className={ui.grid}>
                {remixes.map((p) => (
                  <ProjectCardView key={p.id} slug={slug} p={p} />
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
