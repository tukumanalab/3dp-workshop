import { describe, expect, it } from "vitest";
import { DELETE as participantsDelete, POST as participantsPost } from "@/app/api/workshops/[slug]/participants/route";
import { PATCH as participantPatch } from "@/app/api/workshops/[slug]/participants/[participantId]/route";
import { PATCH as reorderPatch } from "@/app/api/workshops/[slug]/sessions/reorder/route";
import { POST as joinPost } from "@/app/api/workshops/[slug]/join/route";
import { prisma } from "@/lib/db";
import { LAST_ACCESS_THROTTLE_MS, lastActiveAt } from "@/lib/lastAccess";
import { viewerFromJar } from "@/lib/viewer";
import { PARTICIPANT_COOKIE_PREFIX } from "@/lib/session";
import { resetRateLimits } from "@/lib/ratelimit";
import { mkUser, participantCookie, seedWorkshop, userCookie } from "./helpers";
import { ctx, jsonReq, wsUrl } from "./workshopReq";

describe("participant pre-registration", () => {
  it("registers valid rows and reports skipped ones with line numbers", async () => {
    const { workshop, owner } = await seedWorkshop();
    const slug = workshop.slug;
    const cookie = await userCookie(owner.id);
    const res = await participantsPost(
      jsonReq(wsUrl(slug, "/participants"), "POST", cookie, {
        participants: [
          { displayName: "たろう" },
          { displayName: "はなこ", loginId: "Hanako", pin: "1234" },
          { displayName: "", loginId: "x1" },
          { displayName: "じろう", loginId: "hanako" },
          { displayName: "さぶろう", pin: "12" },
          { displayName: "しろう", loginId: "a b" },
        ],
      }),
      ctx({ slug }),
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { created: { loginId: string; pin: string | null }[]; skipped: { line: number }[] };
    expect(j.created.map((c) => c.loginId)).toContain("hanako");
    expect(j.created).toHaveLength(2);
    expect(j.skipped.map((s) => s.line)).toEqual([3, 4, 5, 6]);
    // 事前登録した ID と PIN でログインできる
    resetRateLimits();
    const login = await joinPost(jsonReq(wsUrl(slug, "/join"), "POST", undefined, { loginId: "HANAKO", pin: "1234" }), ctx({ slug }));
    expect(login.status).toBe(200);
  });

  it("only staff can register", async () => {
    const { workshop } = await seedWorkshop();
    const other = await mkUser();
    const res = await participantsPost(jsonReq(wsUrl(workshop.slug, "/participants"), "POST", other.cookie, { participants: [{ displayName: "x" }] }), ctx({ slug: workshop.slug }));
    expect(res.status).toBe(403);
  });

  it("staff can set a specific PIN", async () => {
    const { workshop, owner, mkParticipant } = await seedWorkshop();
    const p = await mkParticipant("p");
    const cookie = await userCookie(owner.id);
    const c = ctx({ slug: workshop.slug, participantId: String(p.id) });
    expect((await participantPatch(jsonReq(wsUrl(workshop.slug, `/participants/${p.id}`), "PATCH", cookie, { pin: "12a4" }), c)).status).toBe(400);
    expect((await participantPatch(jsonReq(wsUrl(workshop.slug, `/participants/${p.id}`), "PATCH", cookie, { pin: "4321" }), c)).status).toBe(200);
    resetRateLimits();
    const login = await joinPost(jsonReq(wsUrl(workshop.slug, "/join"), "POST", undefined, { loginId: p.loginId, pin: "4321" }), ctx({ slug: workshop.slug }));
    expect(login.status).toBe(200);
  });
});

describe("session reorder", () => {
  it("rewrites order and rejects partial lists", async () => {
    const { workshop, owner, pub, priv } = await seedWorkshop();
    const cookie = await userCookie(owner.id);
    const slug = workshop.slug;
    expect((await reorderPatch(jsonReq(wsUrl(slug, "/sessions/reorder"), "PATCH", cookie, { ids: [priv.id] }), ctx({ slug }))).status).toBe(400);
    expect((await reorderPatch(jsonReq(wsUrl(slug, "/sessions/reorder"), "PATCH", cookie, { ids: [priv.id, pub.id] }), ctx({ slug }))).status).toBe(200);
    const sessions = await prisma.session.findMany({ where: { workshopId: workshop.id }, orderBy: { order: "asc" } });
    expect(sessions.map((s) => s.id)).toEqual([priv.id, pub.id]);
  });
});

describe("closed workshop", () => {
  it("join is rejected only by isOpen", async () => {
    const { workshop } = await seedWorkshop();
    await prisma.workshop.update({ where: { id: workshop.id }, data: { isOpen: false } });
    resetRateLimits();
    const res = await joinPost(jsonReq(wsUrl(workshop.slug, "/join"), "POST", undefined, { joinCode: workshop.joinCode, displayName: "x" }), ctx({ slug: workshop.slug }));
    expect(res.status).toBe(403);
  });
});

describe("bulk participant delete", () => {
  it("staff soft-deletes the given participants of this workshop only", async () => {
    const { workshop, owner, mkParticipant } = await seedWorkshop();
    const other = await seedWorkshop();
    const a = await mkParticipant("a");
    const b = await mkParticipant("b");
    const keep = await mkParticipant("keep");
    const outsider = await other.mkParticipant("x");
    const cookie = await userCookie(owner.id);
    const slug = workshop.slug;
    const res = await participantsDelete(jsonReq(wsUrl(slug, "/participants"), "DELETE", cookie, { ids: [a.id, b.id, outsider.id] }), ctx({ slug }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { deleted: number }).deleted).toBe(2);
    const rows = await prisma.participant.findMany({ where: { id: { in: [a.id, b.id, keep.id, outsider.id] } } });
    const deleted = Object.fromEntries(rows.map((r) => [r.id, !!r.deletedAt]));
    expect(deleted).toEqual({ [a.id]: true, [b.id]: true, [keep.id]: false, [outsider.id]: false });
    // 削除された参加者はログインできない
    resetRateLimits();
    const login = await joinPost(jsonReq(wsUrl(slug, "/join"), "POST", undefined, { loginId: a.loginId }), ctx({ slug }));
    expect(login.status).toBe(401);
  });

  it("rejects non-staff and malformed bodies", async () => {
    const { workshop, owner, mkParticipant } = await seedWorkshop();
    const p = await mkParticipant("p");
    const slug = workshop.slug;
    const stranger = await mkUser();
    const asParticipant = await participantCookie(p.id, workshop.id);
    const del = (cookie: string | undefined, body: unknown) => participantsDelete(jsonReq(wsUrl(slug, "/participants"), "DELETE", cookie, body), ctx({ slug }));
    expect((await del(stranger.cookie, { ids: [p.id] })).status).toBe(403);
    expect((await del(asParticipant, { ids: [p.id] })).status).toBe(403);
    const cookie = await userCookie(owner.id);
    expect((await del(cookie, { ids: [] })).status).toBe(400);
    expect((await del(cookie, { ids: ["1"] })).status).toBe(400);
    expect((await del(cookie, {})).status).toBe(400);
    expect((await prisma.participant.findUnique({ where: { id: p.id } }))?.deletedAt).toBeNull();
  });
});

describe("participant last access", () => {
  it("is set on join and re-login", async () => {
    const { workshop, mkParticipant } = await seedWorkshop();
    const slug = workshop.slug;
    resetRateLimits();
    const joined = await joinPost(jsonReq(wsUrl(slug, "/join"), "POST", undefined, { joinCode: workshop.joinCode, displayName: "new" }), ctx({ slug }));
    const { loginId } = ((await joined.json()) as { participant: { loginId: string } }).participant;
    expect((await prisma.participant.findFirst({ where: { workshopId: workshop.id, loginId } }))?.lastAccessAt).not.toBeNull();
    const p = await mkParticipant("pre");
    expect(p.lastAccessAt).toBeNull();
    await joinPost(jsonReq(wsUrl(slug, "/join"), "POST", undefined, { loginId: p.loginId }), ctx({ slug }));
    expect((await prisma.participant.findUnique({ where: { id: p.id } }))?.lastAccessAt).not.toBeNull();
  });

  it("is refreshed by requests only after the throttle interval", async () => {
    const { workshop, mkParticipant } = await seedWorkshop();
    const p = await mkParticipant("p");
    const jar = { [PARTICIPANT_COOKIE_PREFIX + workshop.id]: decodeURIComponent((await participantCookie(p.id, workshop.id)).split("=")[1]!) };
    const recent = new Date(Date.now() - LAST_ACCESS_THROTTLE_MS / 2);
    await prisma.participant.update({ where: { id: p.id }, data: { lastAccessAt: recent } });
    await viewerFromJar(jar);
    expect((await prisma.participant.findUnique({ where: { id: p.id } }))?.lastAccessAt?.getTime()).toBe(recent.getTime());
    const old = new Date(Date.now() - LAST_ACCESS_THROTTLE_MS * 2);
    await prisma.participant.update({ where: { id: p.id }, data: { lastAccessAt: old } });
    const viewer = await viewerFromJar(jar);
    expect(viewer.participants).toEqual([{ participantId: p.id, workshopId: workshop.id }]);
    expect((await prisma.participant.findUnique({ where: { id: p.id } }))!.lastAccessAt!.getTime()).toBeGreaterThan(old.getTime() + LAST_ACCESS_THROTTLE_MS);
  });

  it("falls back to the registration time when never recorded", () => {
    const createdAt = "2026-01-01T00:00:00.000Z";
    expect(lastActiveAt({ lastAccessAt: null, createdAt }).toISOString()).toBe(createdAt);
    expect(lastActiveAt({ lastAccessAt: "2026-02-01T00:00:00.000Z", createdAt }).toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });
});
