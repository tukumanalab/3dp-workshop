import { NextResponse } from "next/server";
import { canManageStaff, canViewWorkshop } from "@/lib/access";
import { loadWorkshopBySlug } from "@/lib/context";
import { forbidden, notFound } from "@/lib/http";
import { viewerFromRequest } from "@/lib/viewer";
import { searchStaffCandidates } from "@/lib/workshopStaff";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

/** GET ?q= → 共同運営者の候補（オーナーのみ、2 文字以上、最大 10 件） */
export async function GET(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return notFound();
  if (!canManageStaff(w, viewer)) return forbidden();
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ users: [] });
  return NextResponse.json({ users: await searchStaffCandidates(w, q.slice(0, 100)) });
}
