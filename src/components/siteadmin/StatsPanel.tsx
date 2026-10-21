import type { getSiteStats } from "@/lib/siteStats";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

type Stats = Awaited<ReturnType<typeof getSiteStats>>;

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="grid gap-1 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <span className="text-3xl font-extrabold">{value}</span>
      {sub ? <span className={ui.muted}>{sub}</span> : <span className="text-sm">&nbsp;</span>}
    </div>
  );
}

export function StatsPanel({ stats }: { stats: Stats }) {
  const t = S.siteAdmin.stats;
  const v = stats.workshops.byVisibility;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3 sm:gap-4">
      <Tile
        label={t.users}
        value={stats.users.total}
        sub={`${t.usersAdmin} ${stats.users.admin} / ${t.usersOrganizer} ${stats.users.organizer} / ${t.usersSuspended} ${stats.users.suspended}`}
      />
      <Tile
        label={t.workshops}
        value={stats.workshops.total}
        sub={`${t.public} ${v.PUBLIC ?? 0} / ${t.unlisted} ${v.UNLISTED ?? 0} / ${t.private} ${v.PRIVATE ?? 0}`}
      />
      <Tile label={t.sessions} value={stats.sessions} />
      <Tile label={t.participants} value={stats.participants} />
      <Tile label={t.projects} value={stats.projects.total} sub={`${t.projectsShared} ${stats.projects.shared}`} />
    </div>
  );
}
