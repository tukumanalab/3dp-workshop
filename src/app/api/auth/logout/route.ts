import { NextResponse } from "next/server";
import { config } from "@/lib/env";
import { USER_COOKIE } from "@/lib/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete({ name: USER_COOKIE, path: config.basePath });
  return res;
}
