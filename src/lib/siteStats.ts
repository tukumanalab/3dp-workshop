import { prisma } from "./db";

export async function getSiteStats() {
  const [admins, organizers, suspended, wsGroups, sessions, participants, projects, shared] = await Promise.all([
    prisma.user.count({ where: { role: "admin" } }),
    prisma.user.count({ where: { role: "organizer" } }),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
    prisma.workshop.groupBy({ by: ["visibility"], _count: true }),
    prisma.session.count(),
    prisma.participant.count({ where: { deletedAt: null } }),
    prisma.project.count(),
    prisma.project.count({ where: { isShared: true } }),
  ]);
  const byVisibility: Record<string, number> = { PUBLIC: 0, UNLISTED: 0, PRIVATE: 0 };
  for (const g of wsGroups) byVisibility[g.visibility] = g._count;
  return {
    users: { total: admins + organizers, admin: admins, organizer: organizers, suspended },
    workshops: { total: Object.values(byVisibility).reduce((a, b) => a + b, 0), byVisibility },
    sessions,
    participants,
    projects: { total: projects, shared },
  };
}
