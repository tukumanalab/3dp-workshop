import { describe, expect, it } from "vitest";
import { GET as staffGet, POST as staffPost } from "@/app/api/workshops/[slug]/staff/route";
import { DELETE as staffDelete } from "@/app/api/workshops/[slug]/staff/[userId]/route";
import { GET as candidatesGet } from "@/app/api/workshops/[slug]/staff/candidates/route";
import { POST as ownerPost } from "@/app/api/workshops/[slug]/owner/route";
import { prisma } from "@/lib/db";
import { mkUser, seedWorkshop, userCookie } from "./helpers";
import { ctx, jsonReq, wsUrl } from "./workshopReq";

async function setup() {
  const s = await seedWorkshop();
  return { ...s, ownerCookie: await userCookie(s.owner.id) };
}

describe("co-organizers", () => {
  it("owner adds by email, lists, and removes a co-organizer", async () => {
    const { workshop, ownerCookie } = await setup();
    const slug = workshop.slug;
    const co = await mkUser();
    const add = await staffPost(jsonReq(wsUrl(slug, "/staff"), "POST", ownerCookie, { email: co.user.email.toUpperCase() }), ctx({ slug }));
    expect(add.status).toBe(200);
    // 共同運営者は一覧を見られる
    const list = await staffGet(jsonReq(wsUrl(slug, "/staff"), "GET", co.cookie), ctx({ slug }));
    expect(list.status).toBe(200);
    const j = (await list.json()) as { staff: { userId: number }[] };
    expect(j.staff.map((s) => s.userId)).toEqual([co.user.id]);
    // 重複・オーナー自身は 409
    expect((await staffPost(jsonReq(wsUrl(slug, "/staff"), "POST", ownerCookie, { userId: co.user.id }), ctx({ slug }))).status).toBe(409);
    expect((await staffPost(jsonReq(wsUrl(slug, "/staff"), "POST", ownerCookie, { userId: workshop.ownerId }), ctx({ slug }))).status).toBe(409);
    const del = await staffDelete(jsonReq(wsUrl(slug, `/staff/${co.user.id}`), "DELETE", ownerCookie), ctx({ slug, userId: String(co.user.id) }));
    expect(del.status).toBe(200);
    expect(await prisma.workshopStaff.count({ where: { workshopId: workshop.id } })).toBe(0);
  });

  it("co-organizers cannot manage staff; strangers get 403/404", async () => {
    const { workshop, ownerCookie } = await setup();
    const slug = workshop.slug;
    const co = await mkUser();
    const other = await mkUser();
    await staffPost(jsonReq(wsUrl(slug, "/staff"), "POST", ownerCookie, { userId: co.user.id }), ctx({ slug }));
    expect((await staffPost(jsonReq(wsUrl(slug, "/staff"), "POST", co.cookie, { userId: other.user.id }), ctx({ slug }))).status).toBe(403);
    expect((await candidatesGet(jsonReq(wsUrl(slug, "/staff/candidates?q=User"), "GET", co.cookie), ctx({ slug }))).status).toBe(403);
    expect((await staffGet(jsonReq(wsUrl(slug, "/staff"), "GET", other.cookie), ctx({ slug }))).status).toBe(403);
    expect((await ownerPost(jsonReq(wsUrl(slug, "/owner"), "POST", co.cookie, { userId: co.user.id }), ctx({ slug }))).status).toBe(403);
  });

  it("rejects suspended or unknown users", async () => {
    const { workshop, ownerCookie } = await setup();
    const slug = workshop.slug;
    const sus = await mkUser("organizer", "SUSPENDED");
    expect((await staffPost(jsonReq(wsUrl(slug, "/staff"), "POST", ownerCookie, { userId: sus.user.id }), ctx({ slug }))).status).toBe(409);
    expect((await staffPost(jsonReq(wsUrl(slug, "/staff"), "POST", ownerCookie, { email: "nobody@example.com" }), ctx({ slug }))).status).toBe(404);
  });

  it("candidate search needs 2+ chars and excludes current members", async () => {
    const { workshop, ownerCookie } = await setup();
    const slug = workshop.slug;
    const co = await mkUser();
    const cand = await mkUser();
    await staffPost(jsonReq(wsUrl(slug, "/staff"), "POST", ownerCookie, { userId: co.user.id }), ctx({ slug }));
    const short = (await (await candidatesGet(jsonReq(wsUrl(slug, "/staff/candidates?q=u"), "GET", ownerCookie), ctx({ slug }))).json()) as { users: unknown[] };
    expect(short.users).toEqual([]);
    const res = await candidatesGet(jsonReq(wsUrl(slug, `/staff/candidates?q=${encodeURIComponent(cand.user.email)}`), "GET", ownerCookie), ctx({ slug }));
    const j = (await res.json()) as { users: { id: number }[] };
    expect(j.users.map((u) => u.id)).toEqual([cand.user.id]);
    const coSearch = await candidatesGet(jsonReq(wsUrl(slug, `/staff/candidates?q=${encodeURIComponent(co.user.email)}`), "GET", ownerCookie), ctx({ slug }));
    expect(((await coSearch.json()) as { users: unknown[] }).users).toEqual([]);
  });
});

describe("ownership transfer", () => {
  it("transfers to a co-organizer and keeps the previous owner as staff", async () => {
    const { workshop, ownerCookie } = await setup();
    const slug = workshop.slug;
    const co = await mkUser();
    const outsider = await mkUser();
    // 共同運営者以外には委譲できない
    expect((await ownerPost(jsonReq(wsUrl(slug, "/owner"), "POST", ownerCookie, { userId: outsider.user.id }), ctx({ slug }))).status).toBe(409);
    await staffPost(jsonReq(wsUrl(slug, "/staff"), "POST", ownerCookie, { userId: co.user.id }), ctx({ slug }));
    const res = await ownerPost(jsonReq(wsUrl(slug, "/owner"), "POST", ownerCookie, { userId: co.user.id }), ctx({ slug }));
    expect(res.status).toBe(200);
    const w = await prisma.workshop.findUniqueOrThrow({ where: { id: workshop.id }, include: { staff: true } });
    expect(w.ownerId).toBe(co.user.id);
    expect(w.staff.map((s) => s.userId)).toEqual([workshop.ownerId]);
    // 元の主催者はもう共同運営者を管理できない
    expect((await staffPost(jsonReq(wsUrl(slug, "/staff"), "POST", ownerCookie, { userId: outsider.user.id }), ctx({ slug }))).status).toBe(403);
  });
});
