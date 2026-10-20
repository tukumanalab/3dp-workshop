import { NextResponse } from "next/server";

export const jsonError = (error: string, status: number, extra?: Record<string, unknown>) =>
  NextResponse.json({ error, ...extra }, { status });

export const notFound = () => jsonError("見つかりません", 404);
export const unauthorized = () => jsonError("ログインが必要です", 401);
export const forbidden = () => jsonError("権限がありません", 403);

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    const v = await req.json();
    return v && typeof v === "object" ? (v as T) : null;
  } catch {
    return null;
  }
}
