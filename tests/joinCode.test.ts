import { beforeEach, describe, expect, it } from "vitest";
import { PATCH as workshopPatch } from "@/app/api/workshops/[slug]/route";
import { POST as join } from "@/app/api/workshops/[slug]/join/route";
import { resetRateLimits } from "@/lib/ratelimit";
import { newUid } from "@/lib/crypto";
import { validateJoinCode } from "@/lib/workshops";
import { mkUser, participantCookie, seedWorkshop, userCookie } from "./helpers";
import { ctx, jsonReq, wsUrl } from "./workshopReq";

beforeEach(() => resetRateLimits());

const uniqueCode = () => `C-${newUid().toUpperCase()}`;

describe("validateJoinCode", () => {
  it("normalizes to upper case and enforces the format", () => {
    expect(validateJoinCode(" spring-2026 ")).toBe("SPRING-2026");
    expect(validateJoinCode("ABCD")).toBe("ABCD");
    expect(validateJoinCode("ABC")).toBeNull();
    expect(validateJoinCode("A".repeat(21))).toBeNull();
    expect(validateJoinCode("-ABC")).toBeNull();
    expect(validateJoinCode("AB CD")).toBeNull();
    expect(validateJoinCode("あいうえ")).toBeNull();
    expect(validateJoinCode(1234)).toBeNull();
  });
});

describe("set join code", () => {
  it("staff sets a custom code; participants join with it and the old code stops working", async () => {
    const { workshop, owner } = await seedWorkshop();
    const slug = workshop.slug;
    const code = uniqueCode();
    const res = await workshopPatch(jsonReq(wsUrl(slug), "PATCH", await userCookie(owner.id), { joinCode: code.toLowerCase() }), ctx({ slug }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { workshop: { joinCode: string } }).workshop.joinCode).toBe(code);

    const joinReq = (joinCode: string) => jsonReq(wsUrl(slug, "/join"), "POST", undefined, { joinCode, displayName: "x" });
    expect((await join(joinReq(workshop.joinCode!), ctx({ slug }))).status).toBe(403);
    expect((await join(joinReq(code), ctx({ slug }))).status).toBe(200);
  });

  it("rejects invalid and already-used codes", async () => {
    const a = await seedWorkshop();
    const b = await seedWorkshop();
    const staff = await userCookie(a.owner.id);
    const slug = a.workshop.slug;
    expect((await workshopPatch(jsonReq(wsUrl(slug), "PATCH", staff, { joinCode: "AB" }), ctx({ slug }))).status).toBe(400);
    expect((await workshopPatch(jsonReq(wsUrl(slug), "PATCH", staff, { joinCode: b.workshop.joinCode }), ctx({ slug }))).status).toBe(409);
    // 今と同じコードはそのまま OK
    expect((await workshopPatch(jsonReq(wsUrl(slug), "PATCH", staff, { joinCode: a.workshop.joinCode }), ctx({ slug }))).status).toBe(200);
  });

  it("non-staff cannot change the code", async () => {
    const { workshop, mkParticipant } = await seedWorkshop();
    const slug = workshop.slug;
    const other = await mkUser();
    const p = await mkParticipant("p");
    const body = { joinCode: uniqueCode() };
    expect((await workshopPatch(jsonReq(wsUrl(slug), "PATCH", other.cookie, body), ctx({ slug }))).status).toBe(403);
    expect((await workshopPatch(jsonReq(wsUrl(slug), "PATCH", await participantCookie(p.id, workshop.id), body), ctx({ slug }))).status).toBe(403);
  });
});
