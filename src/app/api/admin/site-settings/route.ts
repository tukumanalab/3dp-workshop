import { NextResponse } from "next/server";
import { requireSiteAdmin } from "@/lib/adminGuard";
import { jsonError, readJson } from "@/lib/http";
import { getSiteSettings, updateSiteSettings } from "@/lib/siteSettings";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await requireSiteAdmin(req);
  if ("response" in g) return g.response;
  return NextResponse.json({ settings: await getSiteSettings() });
}

export async function PATCH(req: Request) {
  const g = await requireSiteAdmin(req);
  if ("response" in g) return g.response;
  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return jsonError("リクエストが不正です", 400);
  const r = await updateSiteSettings(body);
  if ("error" in r) return jsonError(r.error, 400);
  return NextResponse.json({ settings: r.settings });
}
