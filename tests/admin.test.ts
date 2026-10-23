import { beforeEach, describe, expect, it } from "vitest";
import { GET as statsGet } from "@/app/api/admin/stats/route";
import { GET as usersGet, POST as usersPost } from "@/app/api/admin/users/route";
import { DELETE as userDelete, PATCH as userPatch } from "@/app/api/admin/users/[id]/route";
import { GET as workshopsGet } from "@/app/api/admin/workshops/route";
import { DELETE as workshopDelete, PATCH as workshopPatch } from "@/app/api/admin/workshops/[slug]/route";
import { POST as ownerPost } from "@/app/api/admin/workshops/[slug]/owner/route";
import { GET as settingsGet, PATCH as settingsPatch } from "@/app/api/admin/site-settings/route";
import { viewerFromRequest } from "@/lib/viewer";
import { prisma } from "@/lib/db";
import { newUid } from "@/lib/crypto";
import { readLyl, writeLyl } from "@/lib/storage";
import { countActiveAdmins, wouldRemoveLastAdmin } from "@/lib/adminGuard";
import { getSiteSettings } from "@/lib/siteSettings";
import { mkUser, seedWorkshop } from "./helpers";

const url = (p: string) => `http://localhost/3dp/api/admin${p}`;
const req = (p: string, method = "GET", cookie?: string, body?: unknown) =>
  new Request(url(p), {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const idCtx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });
const slugCtx = (slug: string) => ({ params: Promise.resolve({ slug }) });

// 有効な admin を 1 人だけの状態にする（既存 admin は organizer に落とす）。
async function onlyAdmin() {
  await prisma.user.updateMany({ where: { role: "admin" }, data: { role: "organizer" } });
  return mkUser("admin");
}

describe("access gate", () => {
  it("401 for anonymous, 404 for organizer, 200 for admin on every endpoint", async () => {
    const org = await mkUser("organizer");
    const adm = await mkUser("admin");
    const { workshop } = await seedWorkshop();
    const cases: [string, () => Promise<Response>][] = [
      ["stats", () => statsGet(req("/stats", "GET", undefined))],
      ["users", () => usersGet(req("/users"))],
      ["workshops", () => workshopsGet(req("/workshops"))],
      ["settings", () => settingsGet(req("/site-settings"))],
    ];
    for (const [, run] of cases) expect((await run()).status).toBe(401);
    const withCookie = (cookie: string): [string, () => Promise<Response>][] => [
      ["stats", () => statsGet(req("/stats", "GET", cookie))],
      ["users", () => usersGet(req("/users", "GET", cookie))],
      ["workshops", () => workshopsGet(req("/workshops", "GET", cookie))],
      ["settings", () => settingsGet(req("/site-settings", "GET", cookie))],
    ];
    for (const [, run] of withCookie(org.cookie)) expect((await run()).status).toBe(404);
    for (const [, run] of withCookie(adm.cookie)) expect((await run()).status).toBe(200);
    // 書き込み系も organizer は 404
    expect((await usersPost(req("/users", "POST", org.cookie, { email: "x@example.com", name: "x" }))).status).toBe(404);
    expect((await userPatch(req("/users/1", "PATCH", org.cookie, { name: "x" }), idCtx(org.user.id))).status).toBe(404);
    expect((await userDelete(req("/users/1", "DELETE", org.cookie), idCtx(adm.user.id))).status).toBe(404);
    expect((await workshopPatch(req("/w", "PATCH", org.cookie, { isOpen: false }), slugCtx(workshop.slug))).status).toBe(404);
    expect((await workshopDelete(req("/w", "DELETE", org.cookie), slugCtx(workshop.slug))).status).toBe(404);
    expect((await ownerPost(req("/o", "POST", org.cookie, { userId: org.user.id }), slugCtx(workshop.slug))).status).toBe(404);
    expect((await settingsPatch(req("/site-settings", "PATCH", org.cookie, { siteName: "x" }))).status).toBe(404);
  });

  it("stats returns counts", async () => {
    const adm = await mkUser("admin");
    const j = await (await statsGet(req("/stats", "GET", adm.cookie))).json();
    expect(j.stats.users.total).toBeGreaterThan(0);
    expect(j.stats.workshops.byVisibility).toHaveProperty("PUBLIC");
    expect(j.stats.projects).toHaveProperty("shared");
  });
});

describe("users", () => {
  it("lists with filters and counts", async () => {
    const adm = await mkUser("admin");
    const sus = await mkUser("organizer", "SUSPENDED");
    const j = await (await usersGet(req("/users?status=SUSPENDED", "GET", adm.cookie))).json();
    expect(j.users.some((u: { id: number }) => u.id === sus.user.id)).toBe(true);
    expect(j.users.every((u: { status: string }) => u.status === "SUSPENDED")).toBe(true);
    const byRole = await (await usersGet(req("/users?role=admin", "GET", adm.cookie))).json();
    expect(byRole.users.every((u: { role: string }) => u.role === "admin")).toBe(true);
    const byQ = await (await usersGet(req(`/users?q=${encodeURIComponent(sus.user.email)}`, "GET", adm.cookie))).json();
    expect(byQ.users).toHaveLength(1);
    expect(byQ.users[0]).toHaveProperty("workshopCount");
    expect(byQ.users[0]).toHaveProperty("projectCount");
    const capped = await (await usersGet(req("/users?pageSize=1000", "GET", adm.cookie))).json();
    expect(capped.pageSize).toBe(100);
  });

  it("pre-registers, rejects duplicates", async () => {
    const adm = await mkUser("admin");
    const email = `pre-${newUid()}@example.com`;
    const res = await usersPost(req("/users", "POST", adm.cookie, { email: email.toUpperCase(), name: "事前", role: "admin" }));
    expect(res.status).toBe(201);
    const created = await prisma.user.findUnique({ where: { email } });
    expect(created).toMatchObject({ role: "admin", status: "APPROVED", passwordHash: null, googleSub: null });
    expect((await usersPost(req("/users", "POST", adm.cookie, { email, name: "dup" }))).status).toBe(409);
    expect((await usersPost(req("/users", "POST", adm.cookie, { email: "bad", name: "x" }))).status).toBe(400);
    expect((await usersPost(req("/users", "POST", adm.cookie, { email: `a-${newUid()}@example.com`, name: "x", role: "root" }))).status).toBe(400);
  });

  it("refuses changing own role/status (400) but allows own name", async () => {
    const adm = await mkUser("admin");
    expect((await userPatch(req("/u", "PATCH", adm.cookie, { role: "organizer" }), idCtx(adm.user.id))).status).toBe(400);
    expect((await userPatch(req("/u", "PATCH", adm.cookie, { status: "SUSPENDED" }), idCtx(adm.user.id))).status).toBe(400);
    expect((await userPatch(req("/u", "PATCH", adm.cookie, { name: "改名" }), idCtx(adm.user.id))).status).toBe(200);
  });

  it("allows demoting another admin while one other active admin remains", async () => {
    const a = await onlyAdmin();
    const b = await mkUser("admin");
    expect((await userPatch(req("/u", "PATCH", a.cookie, { role: "organizer" }), idCtx(b.user.id))).status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: b.user.id } }))!.role).toBe("organizer");
    // 操作者自身は 400（締め出し防止）
    expect((await userPatch(req("/u", "PATCH", a.cookie, { role: "organizer" }), idCtx(a.user.id))).status).toBe(400);
    expect((await userDelete(req("/u", "DELETE", a.cookie), idCtx(a.user.id))).status).toBe(400);
  });

  it("last active admin guard counts only APPROVED admins", async () => {
    // 操作者は常に有効 admin なので、HTTP 経由では「自分以外の最後の admin」は発生しない（自分は 400 で先に弾かれる）。
    // ガード本体を直接検証する。
    const a = await onlyAdmin();
    const suspended = await mkUser("admin", "SUSPENDED");
    expect(await countActiveAdmins()).toBe(1);
    expect(await wouldRemoveLastAdmin(a.user)).toBe(true);
    expect(await wouldRemoveLastAdmin(suspended.user)).toBe(false); // 停止中は数えない
    const b = await mkUser("admin");
    expect(await countActiveAdmins()).toBe(2);
    expect(await wouldRemoveLastAdmin(a.user)).toBe(false);
    expect(await wouldRemoveLastAdmin(b.user)).toBe(false);
    // 停止中 admin の削除は許可される
    expect((await userDelete(req("/u", "DELETE", a.cookie), idCtx(suspended.user.id))).status).toBe(200);
  });

  it("a suspended user loses viewer.user on the next request", async () => {
    const adm = await mkUser("admin");
    const target = await mkUser("organizer");
    const before = await viewerFromRequest(req("/x", "GET", target.cookie));
    expect(before.user?.userId).toBe(target.user.id);
    expect((await userPatch(req("/u", "PATCH", adm.cookie, { status: "SUSPENDED" }), idCtx(target.user.id))).status).toBe(200);
    const after = await viewerFromRequest(req("/x", "GET", target.cookie));
    expect(after.user).toBeUndefined();
  });

  it("demotion takes effect immediately (role read from DB)", async () => {
    const a = await mkUser("admin");
    const b = await mkUser("admin");
    expect((await userPatch(req("/u", "PATCH", a.cookie, { role: "organizer" }), idCtx(b.user.id))).status).toBe(200);
    // b の cookie には role=admin が残っているが、DB が organizer なので 404
    expect((await usersGet(req("/users", "GET", b.cookie))).status).toBe(404);
  });

  it("rejects duplicate email on edit (409) and invalid input (400)", async () => {
    const adm = await mkUser("admin");
    const x = await mkUser("organizer");
    const y = await mkUser("organizer");
    expect((await userPatch(req("/u", "PATCH", adm.cookie, { email: y.user.email }), idCtx(x.user.id))).status).toBe(409);
    expect((await userPatch(req("/u", "PATCH", adm.cookie, { role: "root" }), idCtx(x.user.id))).status).toBe(400);
    expect((await userPatch(req("/u", "PATCH", adm.cookie, { name: "  " }), idCtx(x.user.id))).status).toBe(400);
    const ok = await userPatch(req("/u", "PATCH", adm.cookie, { name: "新名", email: `NEW-${newUid()}@Example.com` }), idCtx(x.user.id));
    expect(ok.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: x.user.id } }))!.email).toBe((await ok.json()).user.email);
  });

  it("delete: 400 self, 409 workshop owner, 409 has projects, otherwise ok", async () => {
    const adm = await mkUser("admin");
    expect((await userDelete(req("/u", "DELETE", adm.cookie), idCtx(adm.user.id))).status).toBe(400);

    const { owner } = await seedWorkshop();
    expect((await userDelete(req("/u", "DELETE", adm.cookie), idCtx(owner.id))).status).toBe(409);

    const author = await mkUser("organizer");
    const { workshop, pub } = await seedWorkshop();
    await prisma.project.create({
      data: { uid: newUid(), workshopId: workshop.id, sessionId: pub.id, userId: author.user.id, title: "p" },
    });
    expect((await userDelete(req("/u", "DELETE", adm.cookie), idCtx(author.user.id))).status).toBe(409);

    const plain = await mkUser("organizer");
    expect((await userDelete(req("/u", "DELETE", adm.cookie), idCtx(plain.user.id))).status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: plain.user.id } })).toBeNull();
    expect((await userDelete(req("/u", "DELETE", adm.cookie), idCtx(plain.user.id))).status).toBe(404);
  });
});

describe("workshops", () => {
  it("lists all workshops including private, with owner and isMember", async () => {
    const adm = await mkUser("admin");
    const { workshop } = await seedWorkshop("PRIVATE");
    const j = await (await workshopsGet(req("/workshops", "GET", adm.cookie))).json();
    const row = j.workshops.find((w: { slug: string }) => w.slug === workshop.slug);
    expect(row).toBeTruthy();
    expect(row.owner).toHaveProperty("email");
    expect(row.isMember).toBe(false);
    expect(row).toHaveProperty("participantCount");
    const f = await (await workshopsGet(req("/workshops?visibility=PRIVATE", "GET", adm.cookie))).json();
    expect(f.workshops.every((w: { visibility: string }) => w.visibility === "PRIVATE")).toBe(true);
  });

  it("PATCH accepts only visibility and isOpen", async () => {
    const adm = await mkUser("admin");
    const { workshop } = await seedWorkshop();
    const res = await workshopPatch(
      req("/w", "PATCH", adm.cookie, { title: "HACK", visibility: "UNLISTED", isOpen: false }),
      slugCtx(workshop.slug),
    );
    expect(res.status).toBe(200);
    const w = await prisma.workshop.findUnique({ where: { id: workshop.id } });
    expect(w).toMatchObject({ title: "WS", visibility: "UNLISTED", isOpen: false });
    expect((await workshopPatch(req("/w", "PATCH", adm.cookie, { visibility: "NOPE" }), slugCtx(workshop.slug))).status).toBe(400);
    expect((await workshopPatch(req("/w", "PATCH", adm.cookie, {}), slugCtx("no-such"))).status).toBe(404);
  });

  it("reassigns owner; suspended / same owner are 409; staff target row is removed; keep previous as staff", async () => {
    const adm = await mkUser("admin");
    const { workshop, owner } = await seedWorkshop();
    const next = await mkUser("organizer");
    await prisma.workshopStaff.create({ data: { workshopId: workshop.id, userId: next.user.id } });

    const suspended = await mkUser("organizer", "SUSPENDED");
    expect((await ownerPost(req("/o", "POST", adm.cookie, { email: suspended.user.email }), slugCtx(workshop.slug))).status).toBe(409);
    expect((await ownerPost(req("/o", "POST", adm.cookie, { email: owner.email }), slugCtx(workshop.slug))).status).toBe(409);
    expect((await ownerPost(req("/o", "POST", adm.cookie, { email: "nobody@example.com" }), slugCtx(workshop.slug))).status).toBe(404);

    const res = await ownerPost(
      req("/o", "POST", adm.cookie, { email: next.user.email.toUpperCase(), keepPreviousOwnerAsStaff: true }),
      slugCtx(workshop.slug),
    );
    expect(res.status).toBe(200);
    const w = await prisma.workshop.findUnique({ where: { id: workshop.id }, include: { staff: true } });
    expect(w!.ownerId).toBe(next.user.id);
    expect(w!.staff.map((s) => s.userId)).toEqual([owner.id]);

    // keep しない場合は元 owner は staff に残らない
    const again = await ownerPost(req("/o", "POST", adm.cookie, { userId: owner.id }), slugCtx(workshop.slug));
    expect(again.status).toBe(200);
    const w2 = await prisma.workshop.findUnique({ where: { id: workshop.id }, include: { staff: true } });
    expect(w2!.ownerId).toBe(owner.id);
    expect(w2!.staff).toHaveLength(0);
  });

  it("delete removes DB rows and project files", async () => {
    const adm = await mkUser("admin");
    const { workshop, pub, owner } = await seedWorkshop();
    const uid = newUid();
    await prisma.project.create({ data: { uid, workshopId: workshop.id, sessionId: pub.id, userId: owner.id, title: "p" } });
    await writeLyl(uid, "1", new Uint8Array([1, 2, 3]));
    expect(await readLyl(uid, "1")).not.toBeNull();
    expect((await workshopDelete(req("/w", "DELETE", adm.cookie), slugCtx(workshop.slug))).status).toBe(200);
    expect(await prisma.workshop.findUnique({ where: { id: workshop.id } })).toBeNull();
    expect(await readLyl(uid, "1")).toBeNull();
    expect((await workshopDelete(req("/w", "DELETE", adm.cookie), slugCtx(workshop.slug))).status).toBe(404);
  });
});

describe("site settings", () => {
  beforeEach(async () => {
    await prisma.siteSetting.deleteMany();
  });

  it("returns defaults when no row exists, then updates and reflects", async () => {
    const adm = await mkUser("admin");
    const first = await (await settingsGet(req("/site-settings", "GET", adm.cookie))).json();
    expect(first.settings.siteName).toBe("");
    expect(first.settings.effectiveName).toBe("3DP Workshop");
    expect(first.settings.effectiveDescription.length).toBeGreaterThan(0);

    const res = await settingsPatch(req("/site-settings", "PATCH", adm.cookie, { siteName: " 青山ワークショップ ", operatorName: "情報科学研", footerText: "ご利用ありがとうございます" }));
    expect(res.status).toBe(200);
    const s = await getSiteSettings();
    expect(s).toMatchObject({ siteName: "青山ワークショップ", effectiveName: "青山ワークショップ", operatorName: "情報科学研", footerText: "ご利用ありがとうございます" });
    // 部分更新: 他の項目は保持される
    await settingsPatch(req("/site-settings", "PATCH", adm.cookie, { operatorContact: "a@example.com" }));
    expect((await getSiteSettings()).operatorName).toBe("情報科学研");
    // 空にすると既定値に戻る
    await settingsPatch(req("/site-settings", "PATCH", adm.cookie, { siteName: "" }));
    expect((await getSiteSettings()).effectiveName).toBe("3DP Workshop");
  });

  it("enforces length limits and types", async () => {
    const adm = await mkUser("admin");
    expect((await settingsPatch(req("/site-settings", "PATCH", adm.cookie, { siteName: "x".repeat(61) }))).status).toBe(400);
    expect((await settingsPatch(req("/site-settings", "PATCH", adm.cookie, { siteDescription: "x".repeat(301) }))).status).toBe(400);
    expect((await settingsPatch(req("/site-settings", "PATCH", adm.cookie, { siteName: 5 }))).status).toBe(400);
    expect((await settingsPatch(req("/site-settings", "PATCH", adm.cookie, { siteName: "x".repeat(60) }))).status).toBe(200);
  });
});
