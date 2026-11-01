import { readFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** 本番バンドルの BUILD_COMMIT (scripts/build-bundle.sh が書く)。デプロイ後の確認に使う。開発時は null。 */
function buildCommit(): string | null {
  try {
    return readFileSync(path.join(process.cwd(), "BUILD_COMMIT"), "utf8").trim() || null;
  } catch {
    return null;
  }
}

export async function GET() {
  const commit = buildCommit();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, commit });
  } catch {
    return NextResponse.json({ ok: false, commit }, { status: 503 });
  }
}
