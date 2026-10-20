import { prisma } from "./db";
import { canViewProject, canViewWorkshop, type Viewer } from "./access";

export async function loadWorkshopBySlug(slug: string) {
  return prisma.workshop.findUnique({ where: { slug }, include: { staff: true } });
}

/** 作品 + 所属ワークショップ(staff 付き) + セッション */
export async function loadProjectContext(uid: string) {
  const project = await prisma.project.findUnique({
    where: { uid },
    include: { workshop: { include: { staff: true } }, session: true },
  });
  if (!project) return null;
  const { workshop, session, ...rest } = project;
  return { project: rest, workshop, session };
}

export type ProjectContext = NonNullable<Awaited<ReturnType<typeof loadProjectContext>>>;

export const isProjectVisible = (ctx: ProjectContext, viewer: Viewer) =>
  canViewProject(ctx.workshop, ctx.session, ctx.project, viewer);

export const isWorkshopVisible = (w: Parameters<typeof canViewWorkshop>[0], viewer: Viewer) => canViewWorkshop(w, viewer);
