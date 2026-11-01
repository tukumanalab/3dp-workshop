import { spawn } from "child_process";
import { timingSafeEqual } from "crypto";
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { config } from "@/lib/env";
import { jsonError, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

// GitHub Actions から呼ばれるデプロイ用 Webhook。
// 成果物の取得・入れ替え・再起動は deploy/server-deploy.sh が行う (README「デプロイ」)。

function isValidToken(token: string, secret: string): boolean {
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const secret = config.deploySecret;
  if (!secret) return jsonError("デプロイは設定されていません", 503);

  const token = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!isValidToken(token, secret)) return jsonError("認証に失敗しました", 401);

  const body = await readJson(req);
  const component = String(body?.component ?? "");
  const sha = String(body?.sha ?? "");
  const runId = String(body?.runId ?? "");
  if (!/^(app|editor)$/.test(component) || !/^[0-9a-f]{40}$/.test(sha) || !/^\d+$/.test(runId)) {
    return jsonError("component / sha / runId が不正です", 400);
  }

  const cwd = process.cwd();
  const logDir = path.join(cwd, "logs");
  fs.mkdirSync(logDir, { recursive: true });
  const logFd = fs.openSync(path.join(logDir, "deploy.log"), "a");

  // setsid -f で親プロセスから切り離す (pm2 restart はアプリの子プロセスごと終了させるため)
  const child = spawn("setsid", ["-f", "bash", path.join(cwd, "deploy", "server-deploy.sh"), component, sha, runId], {
    cwd,
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  child.on("error", (error) => console.error("デプロイスクリプトの起動に失敗しました:", error));
  child.unref();
  fs.closeSync(logFd);

  return NextResponse.json({ ok: true }, { status: 202 });
}
