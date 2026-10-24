import Link from "next/link";
import { Plus, Settings, UserRound, Users } from "lucide-react";
import type { Metadata } from "next";
import { Footer, Topbar } from "@/components/Topbar";
import { GallerySearch } from "@/components/GallerySearch";
import { LiveRefresh } from "@/components/LiveRefresh";
import { MaterialList } from "@/components/MaterialList";
import { ProjectCardView } from "@/components/ProjectCard";
import { StatusFilter } from "@/components/StatusFilter";
import { canCreateProject, isWorkshopParticipant, isWorkshopStaff, isWorkshopWritable } from "@/lib/access";
import {
  galleryBackParam,
  listProjectsForViewer,
  parseProjectSort,
  parseSearchQuery,
  searchProjects,
  sortProjects,
  type ProjectSort,
} from "@/lib/gallery";
import { listVisibleMaterials, serializeMaterial } from "@/lib/materials";
import { loadWorkshopPage } from "@/lib/pages";
import { activeStatusFilter, filterProjectsByStatus, listStatusLabels, parseStatusFilter, type StatusFilterToken } from "@/lib/statuses";
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
  searchParams: Promise<{ session?: string; sort?: string; q?: string; status?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { viewer, workshop, sessions, allSessions } = await loadWorkshopPage(slug);
  const active = sessions.find((s) => String(s.id) === sp.session) ?? sessions[0];
  const sort = parseProjectSort(sp.sort);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const terms = parseSearchQuery(q);
  const labels = await listStatusLabels(workshop.id);
  const statusTokens = activeStatusFilter(labels, parseStatusFilter(sp.status));
  const filtering = statusTokens.length > 0;
  const searching = terms.length > 0;
  // 検索中・状態での絞り込み中はワークショップ内の全セッションから探す（見える作品だけ）
  const crossSession = searching || filtering;
  const projects = sortProjects(
    crossSession
      ? filterProjectsByStatus(searchProjects((await listProjectsForViewer(workshop, viewer)) ?? [], terms), labels, statusTokens)
      : active
        ? ((await listProjectsForViewer(workshop, viewer, { sessionId: active.id })) ?? [])
        : [],
    sort,
  );
  // 既定（更新が新しい順）のときは URL に sort を付けない
  const sortQuery = sort === "recent" ? "" : `&sort=${sort}`;
  const href = (o: { sort?: ProjectSort; status?: StatusFilterToken[] }) => {
    const params = new URLSearchParams();
    if (active) params.set("session", String(active.id));
    if (searching) params.set("q", q);
    const v = o.sort ?? sort;
    if (v !== "recent") params.set("sort", v);
    const st = o.status ?? statusTokens;
    if (st.length > 0) params.set("status", st.join(","));
    return `/${slug}?${params.toString()}`;
  };
  // 作品ページの「戻る」でこの一覧（絞り込み・検索・並び順）に戻れるように
  const back = galleryBackParam(new URLSearchParams(href({}).split("?")[1] ?? ""));
  const teaching = crossSession ? [] : projects.filter((p) => p.isTeachingMaterial);
  const others = crossSession ? projects : projects.filter((p) => !p.isTeachingMaterial);
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
          {sessions.length > 1 || allSessions.length > 0 ? (
            <div className={ui.tabsRow}>
              {sessions.length > 1 ? (
                <nav className={ui.tabList} aria-label="sessions">
                  {sessions.map((s) => (
                    <Link key={s.id} className={!crossSession && s.id === active?.id ? ui.tabActive : ui.tab} href={`/${slug}?session=${s.id}${sortQuery}`}>
                      {s.name}
                    </Link>
                  ))}
                </nav>
              ) : null}
              {allSessions.length > 0 ? (
                <GallerySearch key={q} slug={slug} q={q} sessionId={active?.id ?? null} sort={sort} status={statusTokens.join(",")} />
              ) : null}
            </div>
          ) : null}
          {labels.length > 0 ? (
            <StatusFilter key={statusTokens.join(",")} labels={labels} tokens={statusTokens} hrefFor={(status) => href({ status })} />
          ) : null}
          {/* 状態で絞り込んでいる間は、作品の状態の変化を自動で反映する */}
          {filtering ? <LiveRefresh slug={slug} /> : null}
          {crossSession ? null : <MaterialList materials={materials} />}
          <div className={ui.toolbar}>
            {projects.length > 1 && (active || crossSession) ? (
              <nav className={ui.chips} aria-label={S.workshop.sortLabel}>
                <span>{S.workshop.sortLabel}</span>
                {SORTS.map((o) => (
                  <Link
                    key={o.value}
                    className={o.value === sort ? ui.chipActive : ui.chip}
                    aria-current={o.value === sort ? "true" : undefined}
                    href={href({ sort: o.value })}
                  >
                    {o.label}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>
          {crossSession ? (
            <p className="mb-3 text-sm font-semibold" role="status">
              {searching ? S.workshop.searchResult(q, projects.length) : S.statuses.filterResult(projects.length)}
            </p>
          ) : null}
          {teaching.length > 0 ? (
            <section className="mb-6 grid gap-3" aria-label={S.workshop.teaching}>
              <h2 className="text-base font-bold">{S.workshop.teaching}</h2>
              <div className={ui.grid}>
                {teaching.map((p) => (
                  <ProjectCardView key={p.id} slug={slug} p={p} back={back} />
                ))}
              </div>
            </section>
          ) : null}
          {others.length === 0 ? (
            teaching.length === 0 ? (
              <p className={ui.muted}>{crossSession ? S.workshop.searchNoResult : S.workshop.noProjects}</p>
            ) : null
          ) : (
            <div className={ui.grid}>
              {others.map((p) => (
                <ProjectCardView key={p.id} slug={slug} p={p} showSession={crossSession} back={back} />
              ))}
            </div>
          )}
          <Footer />
        </div>
      </div>
    </main>
  );
}
