import Link from "next/link";
import { Presentation } from "lucide-react";
import { Footer, Topbar } from "@/components/Topbar";
import { prisma } from "@/lib/db";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const workshops = await prisma.workshop.findMany({
    where: { visibility: "PUBLIC" },
    orderBy: { createdAt: "desc" },
    include: { owner: { select: { name: true } }, _count: { select: { projects: true } } },
  });
  return (
    <main className={ui.shell}>
      <Topbar />
      <div>
        <div className={ui.main}>
          <div className={ui.pageHeader}>
            <div>
              <h1 className={ui.h1}>{S.home.title}</h1>
              <span className={ui.subtitle}>{S.home.lead}</span>
            </div>
          </div>
          {workshops.length === 0 ? (
            <p className={ui.muted}>{S.home.empty}</p>
          ) : (
            <div className={ui.grid}>
              {workshops.map((w) => (
                <article className={ui.cardItem} key={w.id}>
                  <Link className={ui.cardLink} href={`/${w.slug}`}>
                    <span className={ui.stage} aria-hidden="true">
                      <span className={ui.emptyMark}>
                        <Presentation size={40} strokeWidth={1.5} />
                      </span>
                    </span>
                    <span className={ui.cardTitle}>{w.title}</span>
                    <span className={ui.cardMeta}>
                      {w.owner.name} · {S.workshop.projects} {w._count.projects}
                    </span>
                  </Link>
                </article>
              ))}
            </div>
          )}
          <p className={`${ui.muted} mt-5`}>{S.home.joinHint}</p>
          <Footer />
        </div>
      </div>
    </main>
  );
}
