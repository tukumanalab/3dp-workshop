import { NextResponse } from "next/server";
import { canViewWorkshop } from "@/lib/access";
import { loadWorkshopBySlug } from "@/lib/context";
import { listProjectsForViewer, projectsDigest } from "@/lib/gallery";
import { notFound } from "@/lib/http";
import { viewerFromRequest } from "@/lib/viewer";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

/** GET → { digest }。絞り込み中の一覧が、作品の変化に気付いて描き直すために使う。 */
export async function GET(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return notFound();
  const digest = projectsDigest((await listProjectsForViewer(w, viewer)) ?? []);
  return NextResponse.json({ digest }, { headers: { "cache-control": "no-store" } });
}
