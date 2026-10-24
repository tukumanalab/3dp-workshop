import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Footer, Topbar } from "@/components/Topbar";
import { ParticipantsTab } from "@/components/workshopadmin/ParticipantsTab";
import { ProjectsTab } from "@/components/workshopadmin/ProjectsTab";
import { SessionsTab } from "@/components/workshopadmin/SessionsTab";
import { SettingsTab } from "@/components/workshopadmin/SettingsTab";
import { StaffTab } from "@/components/workshopadmin/StaffTab";
import { StatusLabelsTab } from "@/components/workshopadmin/StatusLabelsTab";
import { canManageStaff, isWorkshopOwner, isWorkshopStaff } from "@/lib/access";
import { config } from "@/lib/env";
import { prisma } from "@/lib/db";
import { serializeMaterial } from "@/lib/materials";
import { loadWorkshopPage } from "@/lib/pages";
import { listStatusLabels, MAX_STATUS_LABELS } from "@/lib/statuses";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";
import { listStaff } from "@/lib/workshopStaff";

export const dynamic = "force-dynamic";

const TABS = ["settings", "staff", "participants", "sessions", "statuses", "projects"] as const;
type Tab = (typeof TABS)[number];

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "settings";
  const { viewer, workshop, allSessions } = await loadWorkshopPage(slug);
  if (!isWorkshopStaff(workshop, viewer)) {
    if (!viewer.user) redirect(`/login?next=/${slug}/admin`);
    notFound();
  }
  // 資料は基本設定（ワークショップ全体）とセッション編集（セッションごと）で編集する
  const loadMaterials = async () =>
    (await prisma.material.findMany({ where: { workshopId: workshop.id }, orderBy: [{ order: "asc" }, { id: "asc" }] })).map((m) =>
      serializeMaterial(slug, m),
    );

  let panel: React.ReactNode = null;
  if (tab === "settings") {
    panel = (
      <SettingsTab
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
        materials={(await loadMaterials()).filter((m) => m.sessionId === null)}
        maxMaterialBytes={config.maxMaterialBytes}
      />
    );
  } else if (tab === "staff") {
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: workshop.ownerId }, select: { id: true, name: true, email: true } });
    panel = (
      <StaffTab
        slug={slug}
        canManage={canManageStaff(workshop, viewer)}
        owner={{ userId: owner.id, name: owner.name, email: owner.email }}
        staff={await listStaff(workshop.id)}
      />
    );
  } else if (tab === "participants") {
    const participants = await prisma.participant.findMany({
      where: { workshopId: workshop.id, deletedAt: null },
      orderBy: { id: "asc" },
      include: { _count: { select: { projects: true } } },
    });
    panel = (
      <ParticipantsTab
        slug={slug}
        participants={participants.map((p) => ({ id: p.id, loginId: p.loginId, displayName: p.displayName, hasPin: !!p.pinHash, projectCount: p._count.projects }))}
      />
    );
  } else if (tab === "sessions") {
    const counts = await prisma.project.groupBy({ by: ["sessionId"], where: { workshopId: workshop.id }, _count: true });
    panel = (
      <SessionsTab
        slug={slug}
        sessions={allSessions.map((s) => ({
          id: s.id,
          name: s.name,
          visibility: s.visibility,
          defaultShared: s.defaultShared,
          projectCount: counts.find((c) => c.sessionId === s.id)?._count ?? 0,
        }))}
        materials={await loadMaterials()}
        maxMaterialBytes={config.maxMaterialBytes}
      />
    );
  } else if (tab === "statuses") {
    const labels = await listStatusLabels(workshop.id);
    const usage = await prisma.projectStatus.groupBy({ by: ["labelId"], where: { labelId: { in: labels.map((l) => l.id) } }, _count: true });
    panel = (
      <StatusLabelsTab
        slug={slug}
        maxLabels={MAX_STATUS_LABELS}
        labels={labels.map((l) => ({ ...l, usage: usage.find((u) => u.labelId === l.id)?._count ?? 0 }))}
      />
    );
  } else {
    const projects = await prisma.project.findMany({
      where: { workshopId: workshop.id },
      orderBy: { updatedAt: "desc" },
      include: { participant: { select: { displayName: true } }, user: { select: { name: true } } },
    });
    panel = (
      <ProjectsTab
        slug={slug}
        projects={projects.map((p) => ({
          id: p.uid,
          title: p.title,
          authorName: p.participant?.displayName ?? p.user?.name ?? "（不明）",
          sessionName: allSessions.find((s) => s.id === p.sessionId)?.name ?? "",
          isShared: p.isShared,
          isTeachingMaterial: p.isTeachingMaterial,
          updatedAt: p.updatedAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
        }))}
      />
    );
  }

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
          <nav className={ui.tabs} aria-label={S.admin.title}>
            {TABS.map((t) => (
              <Link key={t} className={t === tab ? ui.tabActive : ui.tab} href={`/${slug}/admin?tab=${t}`} aria-current={t === tab ? "page" : undefined}>
                {S.admin.tabs[t]}
              </Link>
            ))}
          </nav>
          {panel}
          <Footer />
        </div>
      </div>
    </main>
  );
}
