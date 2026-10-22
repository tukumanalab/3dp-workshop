import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PATCH as accountPatch } from "@/app/api/account/route";
import { POST as passwordPost } from "@/app/api/account/password/route";
import { prisma } from "@/lib/db";
import { hashSecret, verifySecret } from "@/lib/crypto";
import { resetRateLimits } from "@/lib/ratelimit";
import { mkUser } from "./helpers";

const req = (p: string, method: string, cookie: string | undefined, body: unknown) =>
  new Request(`http://localhost/3dp-workshop/api/account${p}`, {
    method,
    headers: { ...(cookie ? { cookie } : {}), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const patchName = (cookie: string | undefined, name: unknown) => accountPatch(req("", "PATCH", cookie, { name }));
const changePw = (cookie: string | undefined, body: unknown) => passwordPost(req("/password", "POST", cookie, body));
const hashOf = async (id: number) => (await prisma.user.findUnique({ where: { id } }))!.passwordHash;

const prevEnv = process.env.PASSWORD_LOGIN_ENABLED;
beforeEach(() => {
  process.env.PASSWORD_LOGIN_ENABLED = "true";
  resetRateLimits();
});
afterEach(() => {
  if (prevEnv === undefined) delete process.env.PASSWORD_LOGIN_ENABLED;
  else process.env.PASSWORD_LOGIN_ENABLED = prevEnv;
});

describe("PATCH /api/account (display name)", () => {
  it("lets organizers and admins rename themselves", async () => {
    for (const role of ["organizer", "admin"] as const) {
      const { user, cookie } = await mkUser(role);
      const res = await patchName(cookie, "  新しい名前  ");
      expect(res.status).toBe(200);
      expect((await res.json()).user.name).toBe("新しい名前");
      expect((await prisma.user.findUnique({ where: { id: user.id } }))!.name).toBe("新しい名前");
    }
  });

  it("rejects anonymous, suspended, and invalid names", async () => {
    expect((await patchName(undefined, "x")).status).toBe(401);
    const suspended = await mkUser("organizer", "SUSPENDED");
    expect((await patchName(suspended.cookie, "x")).status).toBe(401);
    const { cookie } = await mkUser();
    for (const bad of ["", "   ", "a".repeat(101), 123, null]) expect((await patchName(cookie, bad)).status).toBe(400);
  });

  it("ignores other fields such as role and email", async () => {
    const { user, cookie } = await mkUser("organizer");
    const res = await accountPatch(req("", "PATCH", cookie, { name: "N", role: "admin", email: "evil@example.com" }));
    expect(res.status).toBe(200);
    const after = (await prisma.user.findUnique({ where: { id: user.id } }))!;
    expect(after.role).toBe("organizer");
    expect(after.email).toBe(user.email);
  });
});

describe("POST /api/account/password", () => {
  it("changes the password when the current one is correct", async () => {
    const { user, cookie } = await mkUser("admin");
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashSecret("old-password") } });
    expect((await changePw(cookie, { currentPassword: "wrong-pass", newPassword: "new-password" })).status).toBe(400);
    expect((await changePw(cookie, { newPassword: "new-password" })).status).toBe(400);
    expect(verifySecret("old-password", await hashOf(user.id))).toBe(true);
    const ok = await changePw(cookie, { currentPassword: "old-password", newPassword: "new-password" });
    expect(ok.status).toBe(200);
    expect(verifySecret("new-password", await hashOf(user.id))).toBe(true);
    expect(verifySecret("old-password", await hashOf(user.id))).toBe(false);
  });

  it("lets a user without a password set one without the current password", async () => {
    const { user, cookie } = await mkUser("organizer");
    expect(await hashOf(user.id)).toBeNull();
    expect((await changePw(cookie, { newPassword: "first-password" })).status).toBe(200);
    expect(verifySecret("first-password", await hashOf(user.id))).toBe(true);
  });

  it("validates length and requires login", async () => {
    const { cookie } = await mkUser();
    expect((await changePw(undefined, { newPassword: "long-enough" })).status).toBe(401);
    expect((await changePw(cookie, { newPassword: "short" })).status).toBe(400);
    expect((await changePw(cookie, { newPassword: "a".repeat(201) })).status).toBe(400);
  });

  it("is unavailable when password login is disabled", async () => {
    process.env.PASSWORD_LOGIN_ENABLED = "false";
    const { cookie } = await mkUser();
    expect((await changePw(cookie, { newPassword: "long-enough" })).status).toBe(404);
  });

  it("rate-limits repeated attempts per user", async () => {
    const { user, cookie } = await mkUser();
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashSecret("old-password") } });
    for (let i = 0; i < 10; i += 1) await changePw(cookie, { currentPassword: "wrong-pass", newPassword: "new-password" });
    expect((await changePw(cookie, { currentPassword: "old-password", newPassword: "new-password" })).status).toBe(429);
  });
});
