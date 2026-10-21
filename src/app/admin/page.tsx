import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Footer, Topbar } from "@/components/Topbar";
import { SettingsPanel } from "@/components/siteadmin/SettingsPanel";
import { StatsPanel } from "@/components/siteadmin/StatsPanel";
import { UsersPanel } from "@/components/siteadmin/UsersPanel";
import { WorkshopsPanel } from "@/components/siteadmin/WorkshopsPanel";
import { canAdministerSite } from "@/lib/access";
import { getSiteSettings } from "@/lib/siteSettings";
import { getSiteStats } from "@/lib/siteStats";
import { S } from "@/lib/strings";
import { currentViewer } from "@/lib/viewer";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

const TABS = ["stats", "users", "workshops", "settings"] as const;
type Tab = (typeof TABS)[number];

export default async function SiteAdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const viewer = await currentViewer();
  if (!viewer.user) redirect("/login?next=/admin");
  if (!canAdministerSite(viewer)) notFound();
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "stats";
  return (
    <main className={ui.shell}>
      <Topbar center={S.siteAdmin.title} />
      <div>
        <div className={ui.mainStack}>
          <div className={ui.pageHeader}>
            <h1 className={ui.h1}>{S.siteAdmin.title}</h1>
          </div>
          <nav className={ui.tabs} aria-label={S.siteAdmin.title}>
            {TABS.map((t) => (
              <Link key={t} className={t === tab ? ui.tabActive : ui.tab} href={`/admin?tab=${t}`} aria-current={t === tab ? "page" : undefined}>
                {S.siteAdmin.tabs[t]}
              </Link>
            ))}
          </nav>
          {tab === "stats" ? <StatsPanel stats={await getSiteStats()} /> : null}
          {tab === "users" ? <UsersPanel selfId={viewer.user.userId} /> : null}
          {tab === "workshops" ? <WorkshopsPanel /> : null}
          {tab === "settings" ? <SettingsPanel initial={await getSiteSettings()} /> : null}
          <Footer />
        </div>
      </div>
    </main>
  );
}
