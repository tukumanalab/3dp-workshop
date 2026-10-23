import Link from "next/link";
import type { Metadata } from "next";
import { Footer, Topbar } from "@/components/Topbar";
import { ProjectCardView } from "@/components/ProjectCard";
import { groupProjectsByAuthor, listProjectsForViewer, type AuthorSort } from "@/lib/gallery";
import { loadWorkshopPage } from "@/lib/pages";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${S.workshop.byPerson} - ${slug}` };
}

const SORTS: { value: AuthorSort; label: string }[] = [
  { value: "name", label: S.workshop.sortByName },
  { value: "recent", label: S.workshop.sortByRecent },
];

export default async function PeoplePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const sort: AuthorSort = sp.sort === "recent" ? "recent" : "name";
  const { viewer, workshop } = await loadWorkshopPage(slug);
  // セッションを横断して、見える作品だけを作者ごとにまとめる
  const groups = groupProjectsByAuthor((await listProjectsForViewer(workshop, viewer)) ?? [], sort);
  return (
    <main className={ui.shell}>
      <Topbar center={workshop.title} />
      <div>
        <div className={ui.main}>
          <div className={ui.pageHeader}>
            <div>
              <h1 className={ui.h1}>{S.workshop.byPerson}</h1>
              <span className={ui.subtitle}>{workshop.title}</span>
            </div>
            <div className={ui.controls}>
              <Link className={ui.secondary} href={`/${slug}`}>{S.common.back}</Link>
            </div>
          </div>
          <nav className={ui.tabs} aria-label="sort">
            {SORTS.map((s) => (
              <Link key={s.value} className={s.value === sort ? ui.tabActive : ui.tab} href={`/${slug}/people?sort=${s.value}`}>
                {s.label}
              </Link>
            ))}
          </nav>
          {groups.length === 0 ? (
            <p className={ui.muted}>{S.workshop.noProjectsAll}</p>
          ) : (
            groups.map((g) => (
              <section key={g.key} className="mb-6 grid gap-3" aria-label={g.name}>
                <h2 className="text-base font-bold">
                  {g.name} <span className="text-sm font-normal text-muted">{S.workshop.projectCount(g.projects.length)}</span>
                </h2>
                <div className={ui.grid}>
                  {g.projects.map((p) => (
                    <ProjectCardView key={p.id} slug={slug} p={p} showSession hideAuthor />
                  ))}
                </div>
              </section>
            ))
          )}
          <Footer />
        </div>
      </div>
    </main>
  );
}
