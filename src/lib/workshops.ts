import { prisma } from "./db";
import { newJoinCode, newUid } from "./crypto";
import { canSeeJoinCode, isWorkshopStaff, type Viewer, type WorkshopForAccess } from "./access";

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
export const RESERVED_SLUGS = new Set(["api", "login", "dashboard", "editor", "_next", "assets", "new", "admin"]);

export function validateSlug(slug: unknown): string | null {
  if (typeof slug !== "string") return null;
  const s = slug.trim().toLowerCase();
  return SLUG_RE.test(s) && !RESERVED_SLUGS.has(s) ? s : null;
}

export type WorkshopRow = {
  id: number;
  uid: string;
  slug: string;
  title: string;
  description: string;
  visibility: string;
  joinCode: string | null;
  isOpen: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  ownerId: number;
};

export function serializeWorkshop(w: WorkshopRow & WorkshopForAccess, viewer: Viewer) {
  return {
    uid: w.uid,
    slug: w.slug,
    title: w.title,
    description: w.description,
    visibility: w.visibility,
    isOpen: w.isOpen,
    startsAt: w.startsAt,
    endsAt: w.endsAt,
    joinCode: canSeeJoinCode(w, viewer) ? w.joinCode : undefined,
    isStaff: isWorkshopStaff(w, viewer),
  };
}

export async function createWorkshop(args: {
  ownerId: number;
  slug: string;
  title: string;
  description?: string;
  visibility?: string;
}) {
  let joinCode = newJoinCode();
  for (let i = 0; i < 5 && (await prisma.workshop.findUnique({ where: { joinCode } })); i += 1) joinCode = newJoinCode();
  return prisma.workshop.create({
    data: {
      uid: newUid(),
      slug: args.slug,
      title: args.title,
      description: args.description ?? "",
      visibility: args.visibility ?? "PUBLIC",
      joinCode,
      ownerId: args.ownerId,
      sessions: { create: [{ name: "メインセッション", visibility: "PUBLIC", defaultShared: false, order: 0 }] },
    },
  });
}
