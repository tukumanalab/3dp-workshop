import { notFound } from "next/navigation";
import { canViewSession, canViewWorkshop } from "./access";
import { loadWorkshopBySlug } from "./context";
import { prisma } from "./db";
import { currentViewer } from "./viewer";

export async function loadWorkshopPage(slug: string, opts: { requireView?: boolean } = {}) {
  const viewer = await currentViewer();
  const workshop = await loadWorkshopBySlug(slug);
  if (!workshop) notFound();
  if ((opts.requireView ?? true) && !canViewWorkshop(workshop, viewer)) notFound();
  const all = await prisma.session.findMany({ where: { workshopId: workshop.id }, orderBy: [{ order: "asc" }, { id: "asc" }] });
  const sessions = all.filter((s) => canViewSession(workshop, s, viewer));
  return { viewer, workshop, sessions, allSessions: all };
}

export async function loadProjectPage(slug: string, id: string) {
  const { loadProjectContext, isProjectVisible } = await import("./context");
  const viewer = await currentViewer();
  const ctx = await loadProjectContext(id);
  if (!ctx || ctx.workshop.slug !== slug || !isProjectVisible(ctx, viewer)) notFound();
  return { viewer, ctx };
}
