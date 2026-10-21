import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings, ShieldCheck } from "lucide-react";
import { Footer, Topbar } from "@/components/Topbar";
import { CreateWorkshopForm } from "@/components/CreateWorkshopForm";
import { prisma } from "@/lib/db";
import { canAdministerSite } from "@/lib/access";
import { S } from "@/lib/strings";
import { currentViewer } from "@/lib/viewer";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const viewer = await currentViewer();
  if (!viewer.user) redirect("/login?next=/dashboard");
  const uid = viewer.user.userId;
  const workshops = await prisma.workshop.findMany({
    where: { OR: [{ ownerId: uid }, { staff: { some: { userId: uid } } }] },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { projects: true, participants: true } } },
  });
  return (
    <main className={ui.shell}>
      <Topbar />
      <div>
        <div className={ui.mainStack}>
          <div className={ui.pageHeader}>
            <h1 className={ui.h1}>{S.dashboard.title}</h1>
            {canAdministerSite(viewer) ? (
              <Link className={ui.secondary} href="/admin">
                <ShieldCheck size={16} />
                {S.siteAdmin.link}
              </Link>
            ) : null}
          </div>
          <CreateWorkshopForm />
          {workshops.length === 0 ? (
            <p className={ui.muted}>{S.dashboard.empty}</p>
          ) : (
            <div className={ui.grid}>
              {workshops.map((w) => (
                <article className={ui.cardItem} key={w.id}>
                  <Link className={ui.cardLink} href={`/${w.slug}/admin`}>
                    <span className={ui.stage} aria-hidden="true">
                      <span className={ui.emptyMark}>
                        <Settings size={36} strokeWidth={1.5} />
                      </span>
                    </span>
                    <span className={ui.cardTitle}>{w.title}</span>
                    <span className={ui.cardMeta}>
                      /{w.slug} · {S.workshop.projects} {w._count.projects} · {S.admin.participants} {w._count.participants}
                    </span>
                  </Link>
                </article>
              ))}
            </div>
          )}
          <Footer />
        </div>
      </div>
    </main>
  );
}
