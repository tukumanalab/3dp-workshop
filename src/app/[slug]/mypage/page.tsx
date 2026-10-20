import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Footer, Topbar } from "@/components/Topbar";
import { ProjectCardView } from "@/components/ProjectCard";
import { ApiButton } from "@/components/ApiButton";
import { canCreateProject, participantIdFor } from "@/lib/access";
import { prisma } from "@/lib/db";
import { listProjectsForViewer } from "@/lib/gallery";
import { loadWorkshopPage } from "@/lib/pages";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function MyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { viewer, workshop, sessions } = await loadWorkshopPage(slug);
  const pid = participantIdFor(workshop, viewer);
  if (pid === null && !viewer.user) redirect(`/${slug}/join`);
  const me = pid !== null ? await prisma.participant.findUnique({ where: { id: pid } }) : null;
  const projects = (await listProjectsForViewer(workshop, viewer, { mine: true })) ?? [];
  const first = sessions[0];
  return (
    <main className={ui.shell}>
      <Topbar center={workshop.title} />
      <div>
        <div className={ui.main}>
          <div className={ui.pageHeader}>
            <div>
              <h1 className={ui.h1}>{S.workshop.mypage}</h1>
              {me ? <span className={ui.subtitle}>{me.displayName} · {S.join.loginId}: {me.loginId}</span> : null}
            </div>
            <div className={ui.controls}>
              {canCreateProject(workshop, viewer) && first ? (
                <Link className={ui.primary} href={`/${slug}/projects/new?sessionId=${first.id}`}>
                  <Plus size={16} />
                  <span>{S.workshop.newProject}</span>
                </Link>
              ) : null}
              <Link className={ui.secondary} href={`/${slug}`}>{S.common.back}</Link>
              {pid !== null ? (
                <ApiButton url={`/layerling-workshop/api/workshops/${slug}/leave`} redirectTo={`/${slug}`}>
                  {S.workshop.leave}
                </ApiButton>
              ) : null}
            </div>
          </div>
          {projects.length === 0 ? (
            <p className={ui.muted}>{S.workshop.noProjects}</p>
          ) : (
            <div className={ui.grid}>
              {projects.map((p) => (
                <ProjectCardView key={p.id} slug={slug} p={p} />
              ))}
            </div>
          )}
          <Footer />
        </div>
      </div>
    </main>
  );
}
