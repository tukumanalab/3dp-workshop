import { NextResponse } from "next/server";
import { config } from "@/lib/env";
import { loadWorkshopBySlug } from "@/lib/context";
import { notFound } from "@/lib/http";
import { PARTICIPANT_COOKIE_PREFIX } from "@/lib/session";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { slug } = await params;
  const w = await loadWorkshopBySlug(slug);
  if (!w) return notFound();
  const res = NextResponse.json({ ok: true });
  res.cookies.delete({ name: PARTICIPANT_COOKIE_PREFIX + w.id, path: config.basePath });
  return res;
}
