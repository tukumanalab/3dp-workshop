import { NextResponse } from "next/server";
import { canManageStaff, canViewWorkshop } from "@/lib/access";
import { loadWorkshopBySlug } from "@/lib/context";
import { forbidden, notFound } from "@/lib/http";
import { viewerFromRequest } from "@/lib/viewer";
import { removeStaff } from "@/lib/workshopStaff";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string; userId: string }> };

export async function DELETE(req: Request, { params }: Ctx) {
  const { slug, userId } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return notFound();
  if (!canManageStaff(w, viewer)) return forbidden();
  if (!(await removeStaff(w.id, Number(userId) || -1))) return notFound();
  return NextResponse.json({ ok: true });
}
