import { describe, expect, it } from "vitest";
import { POST as participantsPost } from "@/app/api/workshops/[slug]/participants/route";
import { PATCH as participantPatch } from "@/app/api/workshops/[slug]/participants/[participantId]/route";
import { PATCH as reorderPatch } from "@/app/api/workshops/[slug]/sessions/reorder/route";
import { POST as joinPost } from "@/app/api/workshops/[slug]/join/route";
import { prisma } from "@/lib/db";
import { resetRateLimits } from "@/lib/ratelimit";
import { mkUser, seedWorkshop, userCookie } from "./helpers";
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
