import { NextResponse } from "next/server";
import { requireSiteAdmin } from "@/lib/adminGuard";
import { getSiteStats } from "@/lib/siteStats";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await requireSiteAdmin(req);
  if ("response" in g) return g.response;
  return NextResponse.json({ stats: await getSiteStats() });
}
