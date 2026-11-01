import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.hoisted(() => vi.fn(() => ({ on: vi.fn(), unref: vi.fn() })));
vi.mock("child_process", async (importOriginal) => ({
  ...(await importOriginal<typeof import("child_process")>()),
  spawn: spawnMock,
}));

import { POST as deploy } from "@/app/api/deploy/route";
import { GET as health } from "@/app/api/health/route";

const SECRET = "deploy-secret-for-tests";
const SHA = "0123456789abcdef0123456789abcdef01234567";

function post(body: unknown, auth?: string) {
  return deploy(
    new Request("http://localhost/3dp/api/deploy", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    }),
  );
}

describe("POST /api/deploy", () => {
  let cwd: string;
  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), "lw-deploy-"));
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
    spawnMock.mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("DEPLOY_SECRET が無ければ 503", async () => {
    vi.stubEnv("DEPLOY_SECRET", "");
    const res = await post({ component: "app", sha: SHA, runId: "1" }, `Bearer ${SECRET}`);
    expect(res.status).toBe(503);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("トークンが無い・違うと 401", async () => {
    vi.stubEnv("DEPLOY_SECRET", SECRET);
    expect((await post({ component: "app", sha: SHA, runId: "1" })).status).toBe(401);
    expect((await post({ component: "app", sha: SHA, runId: "1" }, "Bearer wrong")).status).toBe(401);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("component / sha / runId が不正なら 400", async () => {
    vi.stubEnv("DEPLOY_SECRET", SECRET);
    const auth = `Bearer ${SECRET}`;
    expect((await post({ component: "db", sha: SHA, runId: "1" }, auth)).status).toBe(400);
    expect((await post({ component: "app", sha: "main", runId: "1" }, auth)).status).toBe(400);
    expect((await post({ component: "app", sha: SHA, runId: "1; rm -rf /" }, auth)).status).toBe(400);
    expect((await post("not json", auth)).status).toBe(400);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("正しければ server-deploy.sh を切り離して起動し 202", async () => {
    vi.stubEnv("DEPLOY_SECRET", SECRET);
    const res = await post({ component: "editor", sha: SHA, runId: "42" }, `Bearer ${SECRET}`);
    expect(res.status).toBe(202);
    expect(spawnMock).toHaveBeenCalledWith(
      "setsid",
      ["-f", "bash", path.join(cwd, "deploy", "server-deploy.sh"), "editor", SHA, "42"],
      expect.objectContaining({ cwd, detached: true }),
    );
    await expect(fs.stat(path.join(cwd, "logs", "deploy.log"))).resolves.toBeTruthy();
  });
});

describe("GET /api/health", () => {
  afterEach(() => vi.restoreAllMocks());

  it("BUILD_COMMIT があればそのコミットを返す", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "lw-health-"));
    await fs.writeFile(path.join(cwd, "BUILD_COMMIT"), `${SHA}\n`);
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
    const res = await health();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, commit: SHA });
  });

  it("BUILD_COMMIT が無ければ commit は null", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "lw-health-"));
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
    expect(await (await health()).json()).toEqual({ ok: true, commit: null });
  });
});
