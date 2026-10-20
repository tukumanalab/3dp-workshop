import { NextResponse } from "next/server";
import { canViewWorkshop } from "@/lib/access";
import { loadWorkshopBySlug } from "@/lib/context";
import { listProjectsForViewer } from "@/lib/gallery";
import { notFound } from "@/lib/http";
import { viewerFromRequest } from "@/lib/viewer";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return notFound();
  const url = new URL(req.url);
  const sessionIdRaw = url.searchParams.get("sessionId");
  const sessionId = sessionIdRaw ? Number(sessionIdRaw) : undefined;
  const result = await listProjectsForViewer(w, viewer, { sessionId, mine: url.searchParams.get("mine") === "1" });
  if (result === null) return notFound(); // 見えないセッション指定は 404
  return NextResponse.json({ projects: result });
}
