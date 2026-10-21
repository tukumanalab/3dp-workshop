import { beforeEach, describe, expect, it } from "vitest";
import { POST as join } from "@/app/api/workshops/[slug]/join/route";
import { resetRateLimits } from "@/lib/ratelimit";
import { prisma } from "@/lib/db";
import { seedWorkshop } from "./helpers";

const call = (slug: string, body: unknown) =>
  join(
    new Request(`http://localhost/3dp-workshop/api/workshops/${slug}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug }) },
  );

beforeEach(() => resetRateLimits());

describe("join / re-login", () => {
  it("joins with code + display name, server assigns loginId, sets cookie", async () => {
    const { workshop } = await seedWorkshop();
    const res = await call(workshop.slug, { joinCode: workshop.joinCode, displayName: "たろう" });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.participant.loginId).toMatch(/^[a-z0-9]{6}$/);
    expect(res.headers.get("set-cookie")).toContain(`lw_p_${workshop.id}=`);
    expect(res.headers.get("set-cookie")?.toLowerCase()).toContain("httponly");
  });

  it("rejects a wrong join code and invalid PIN format", async () => {
    const { workshop } = await seedWorkshop();
    expect((await call(workshop.slug, { joinCode: "NOPE", displayName: "x" })).status).toBe(403);
    expect((await call(workshop.slug, { joinCode: workshop.joinCode, displayName: "x", pin: "12" })).status).toBe(400);
  });

  it("re-login requires the PIN when one is set", async () => {
    const { workshop } = await seedWorkshop();
    const joined = await (await call(workshop.slug, { joinCode: workshop.joinCode, displayName: "はなこ", pin: "1234" })).json();
    const loginId = joined.participant.loginId as string;
    expect((await call(workshop.slug, { loginId })).status).toBe(401);
    expect((await call(workshop.slug, { loginId, pin: "0000" })).status).toBe(401);
    const ok = await call(workshop.slug, { loginId, pin: "1234" });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toContain("lw_p_");
  });

  it("re-login without PIN works when none was set; deleted participants cannot log in", async () => {
    const { workshop } = await seedWorkshop();
    const joined = await (await call(workshop.slug, { joinCode: workshop.joinCode, displayName: "n" })).json();
    expect((await call(workshop.slug, { loginId: joined.participant.loginId })).status).toBe(200);
    await prisma.participant.updateMany({ where: { workshopId: workshop.id }, data: { deletedAt: new Date() } });
    expect((await call(workshop.slug, { loginId: joined.participant.loginId })).status).toBe(401);
  });

  it("closed workshop refuses new joins", async () => {
    const { workshop } = await seedWorkshop();
    await prisma.workshop.update({ where: { id: workshop.id }, data: { isOpen: false } });
    expect((await call(workshop.slug, { joinCode: workshop.joinCode, displayName: "x" })).status).toBe(403);
  });

  it("rate limits repeated attempts", async () => {
    const { workshop } = await seedWorkshop();
    let last = 0;
    for (let i = 0; i < 25; i += 1) last = (await call(workshop.slug, { loginId: "zzzzzz" })).status;
    expect(last).toBe(429);
  });
});
