import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { viewerFromRequest } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const viewer = await viewerFromRequest(req);
  const user = viewer.user
    ? await prisma.user.findUnique({ where: { id: viewer.user.userId }, select: { id: true, email: true, name: true, role: true } })
    : null;
  return NextResponse.json({ user, participants: viewer.participants ?? [] });
}
