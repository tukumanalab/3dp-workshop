import Link from "next/link";
import { Plus, Settings, UserRound, Users } from "lucide-react";
import type { Metadata } from "next";
import { Footer, Topbar } from "@/components/Topbar";
import { MaterialList } from "@/components/MaterialList";
import { ProjectCardView } from "@/components/ProjectCard";
import { canCreateProject, isWorkshopParticipant, isWorkshopStaff, isWorkshopWritable } from "@/lib/access";
import { listProjectsForViewer, parseProjectSort, sortProjects, type ProjectSort } from "@/lib/gallery";
import { listVisibleMaterials, serializeMaterial } from "@/lib/materials";
import { loadWorkshopPage } from "@/lib/pages";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

const SORTS: { value: ProjectSort; label: string }[] = [
  { value: "recent", label: S.workshop.sortByRecent },
  { value: "title", label: S.workshop.sortByTitle },
];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug };
}

export default async function GalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session?: string; sort?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { viewer, workshop, sessions, allSessions } = await loadWorkshopPage(slug);
  const active = sessions.find((s) => String(s.id) === sp.session) ?? sessions[0];
  const sort = parseProjectSort(sp.sort);
  const projects = sortProjects(
    active ? ((await listProjectsForViewer(workshop, viewer, { sessionId: active.id })) ?? []) : [],
    sort,
  );
  // 既定（更新が新しい順）のときは URL に sort を付けない
  const sortQuery = sort === "recent" ? "" : `&sort=${sort}`;
  const teaching = projects.filter((p) => p.isTeachingMaterial);
  const others = projects.filter((p) => !p.isTeachingMaterial);
  // ワークショップ全体の資料と、表示中セッションの資料
  const materials = (await listVisibleMaterials(workshop, allSessions, viewer))
    .filter((m) => m.sessionId === null || m.sessionId === active?.id)
    .map((m) => serializeMaterial(slug, m));
  const staff = isWorkshopStaff(workshop, viewer);
  const participant = isWorkshopParticipant(workshop, viewer);
  const canCreate = canCreateProject(workshop, viewer);
  return (
    <main className={ui.shell}>
      <Topbar center={workshop.title} />
      <div>
        <div className={ui.main}>
          <div className={ui.pageHeader}>
            <div>
              <h1 className={ui.h1}>{workshop.title}</h1>
              {workshop.description ? <span className={ui.subtitle}>{workshop.description}</span> : null}
            </div>
            <div className={ui.controls}>
              <Link className={ui.secondary} href={`/${slug}/people`}>
                <Users size={16} />
                <span>{S.workshop.byPerson}</span>
              </Link>
              {participant ? (
                <Link className={ui.secondary} href={`/${slug}/mypage`}>
                  <UserRound size={16} />
                  <span>{S.workshop.mypage}</span>
                </Link>
              ) : !staff ? (
                <Link className={ui.secondary} href={`/${slug}/join`}>
                  <UserRound size={16} />
                  <span>{S.workshop.join}</span>
                </Link>
              ) : null}
              {staff ? (
                <Link className={ui.secondary} href={`/${slug}/admin`}>
                  <Settings size={16} />
                  <span>{S.workshop.admin}</span>
                </Link>
              ) : null}
              {canCreate && active ? (
                <Link className={ui.primary} href={`/${slug}/projects/new?sessionId=${active.id}`}>
                  <Plus size={16} />
                  <span>{S.workshop.newProject}</span>
                </Link>
              ) : null}
            </div>
          </div>
          {!isWorkshopWritable(workshop) ? <p className={ui.muted}>{S.workshop.closed}</p> : null}
          {sessions.length > 1 ? (
            <nav className={ui.tabs} aria-label="sessions">
              {sessions.map((s) => (
                <Link key={s.id} className={s.id === active?.id ? ui.tabActive : ui.tab} href={`/${slug}?session=${s.id}${sortQuery}`}>
                  {s.name}
                </Link>
              ))}
            </nav>
          ) : null}
          <MaterialList materials={materials} />
          {projects.length > 1 && active ? (
            <nav className={ui.chips} aria-label={S.workshop.sortLabel}>
              <span>{S.workshop.sortLabel}</span>
              {SORTS.map((o) => (
                <Link
                  key={o.value}
                  className={o.value === sort ? ui.chipActive : ui.chip}
                  aria-current={o.value === sort ? "true" : undefined}
                  href={`/${slug}?session=${active.id}${o.value === "recent" ? "" : `&sort=${o.value}`}`}
                >
                  {o.label}
                </Link>
              ))}
            </nav>
          ) : null}
          {teaching.length > 0 ? (
            <section className="mb-6 grid gap-3" aria-label={S.workshop.teaching}>
              <h2 className="text-base font-bold">{S.workshop.teaching}</h2>
              <div className={ui.grid}>
                {teaching.map((p) => (
                  <ProjectCardView key={p.id} slug={slug} p={p} />
                ))}
              </div>
            </section>
          ) : null}
          {others.length === 0 ? (
            teaching.length === 0 ? <p className={ui.muted}>{S.workshop.noProjects}</p> : null
          ) : (
            <div className={ui.grid}>
              {others.map((p) => (
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
