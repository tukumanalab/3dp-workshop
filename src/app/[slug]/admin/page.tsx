import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Footer, Topbar } from "@/components/Topbar";
import { AdminPanel } from "@/components/AdminPanel";
import { isWorkshopOwner, isWorkshopStaff } from "@/lib/access";
import { config } from "@/lib/env";
import { prisma } from "@/lib/db";
import { loadWorkshopPage } from "@/lib/pages";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { viewer, workshop, allSessions } = await loadWorkshopPage(slug);
  if (!isWorkshopStaff(workshop, viewer)) {
    if (!viewer.user) redirect(`/login?next=/${slug}/admin`);
    notFound();
  }
  const participants = await prisma.participant.findMany({
    where: { workshopId: workshop.id, deletedAt: null },
    orderBy: { id: "asc" },
    include: { _count: { select: { projects: true } } },
  });
  const counts = await prisma.project.groupBy({ by: ["sessionId"], where: { workshopId: workshop.id }, _count: true });
  return (
    <main className={ui.shell}>
      <Topbar center={workshop.title} />
      <div>
        <div className={ui.mainStack}>
          <div className={ui.pageHeader}>
            <div>
              <h1 className={ui.h1}>{S.admin.title}</h1>
              <span className={ui.subtitle}>{workshop.title} · /{workshop.slug}</span>
            </div>
            <Link className={ui.secondary} href={`/${slug}`}>{S.common.back}</Link>
          </div>
          <AdminPanel
            slug={slug}
            origin={config.appOrigin}
            isOwner={isWorkshopOwner(workshop, viewer)}
            workshop={{
              title: workshop.title,
              description: workshop.description,
              visibility: workshop.visibility,
              joinCode: workshop.joinCode ?? "",
              isOpen: workshop.isOpen,
            }}
            sessions={allSessions.map((s) => ({
              id: s.id,
              name: s.name,
              visibility: s.visibility,
              defaultShared: s.defaultShared,
              projectCount: counts.find((c) => c.sessionId === s.id)?._count ?? 0,
            }))}
            participants={participants.map((p) => ({ id: p.id, loginId: p.loginId, displayName: p.displayName, hasPin: !!p.pinHash, projectCount: p._count.projects }))}
          />
          <Footer />
        </div>
      </div>
    </main>
  );
}
