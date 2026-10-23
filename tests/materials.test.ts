import { existsSync } from "fs";
import { describe, expect, it } from "vitest";
import { GET as materialsGet, POST as materialsPost } from "@/app/api/workshops/[slug]/materials/route";
import { DELETE as materialDelete, PATCH as materialPatch } from "@/app/api/workshops/[slug]/materials/[materialId]/route";
import { PATCH as materialsReorder } from "@/app/api/workshops/[slug]/materials/reorder/route";
import { GET as materialFile } from "@/app/api/workshops/[slug]/materials/[materialId]/file/route";
import { PATCH as projectPatch } from "@/app/api/projects/[id]/route";
import { DELETE as workshopDelete } from "@/app/api/workshops/[slug]/route";
import { prisma } from "@/lib/db";
import { newUid } from "@/lib/crypto";
import { materialPath } from "@/lib/storage";
import { mkUser, participantCookie, seedWorkshop, userCookie } from "./helpers";
import { ctx, jsonReq, wsUrl } from "./workshopReq";

function fileReq(slug: string, cookie: string, fields: Record<string, string>, content = "hello") {
  const f = new FormData();
  f.set("file", new File([content], "手順書.pdf", { type: "application/pdf" }));
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return new Request(wsUrl(slug, "/materials"), { method: "POST", headers: { cookie }, body: f });
}

type M = { id: number; title: string; url: string; audience: string };

describe("materials", () => {
  it("staff uploads files and links; visibility follows audience", async () => {
    const { workshop, owner, mkParticipant } = await seedWorkshop("PUBLIC");
    const slug = workshop.slug;
    const staff = await userCookie(owner.id);
    const p = await mkParticipant("p");
    const pc = await participantCookie(p.id, workshop.id);

    const up = await materialsPost(fileReq(slug, staff, { audience: "EVERYONE" }), ctx({ slug }));
    expect(up.status).toBe(200);
    const file = ((await up.json()) as { material: M }).material;
    expect(file.title).toBe("手順書.pdf");
    const link = await materialsPost(jsonReq(wsUrl(slug, "/materials"), "POST", staff, { title: "参考", url: "https://example.com/a", audience: "PARTICIPANT" }), ctx({ slug }));
    expect(link.status).toBe(200);
    await materialsPost(jsonReq(wsUrl(slug, "/materials"), "POST", staff, { title: "運営メモ", url: "https://example.com/b", audience: "STAFF" }), ctx({ slug }));
    // javascript: などは拒否
    expect((await materialsPost(jsonReq(wsUrl(slug, "/materials"), "POST", staff, { title: "x", url: "javascript:alert(1)" }), ctx({ slug }))).status).toBe(400);

    const titles = async (cookie?: string) =>
      ((await (await materialsGet(jsonReq(wsUrl(slug, "/materials"), "GET", cookie), ctx({ slug }))).json()) as { materials: M[] }).materials.map((m) => m.title);
    expect(await titles()).toEqual(["手順書.pdf"]);
    expect(await titles(pc)).toEqual(["手順書.pdf", "参考"]);
    expect(await titles(staff)).toEqual(["手順書.pdf", "参考", "運営メモ"]);

    // ファイル配信: attachment + nosniff
    const dl = await materialFile(jsonReq(wsUrl(slug, `/materials/${file.id}/file`)), ctx({ slug, materialId: String(file.id) }));
    expect(dl.status).toBe(200);
    expect(dl.headers.get("content-disposition")).toContain("attachment");
    expect(dl.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await dl.text()).toBe("hello");

    // STAFF にすると匿名には 404
    await materialPatch(jsonReq(wsUrl(slug, `/materials/${file.id}`), "PATCH", staff, { audience: "STAFF" }), ctx({ slug, materialId: String(file.id) }));
    expect((await materialFile(jsonReq(wsUrl(slug, `/materials/${file.id}/file`)), ctx({ slug, materialId: String(file.id) }))).status).toBe(404);
  });

  it("participants cannot create or delete materials", async () => {
    const { workshop, mkParticipant } = await seedWorkshop();
    const slug = workshop.slug;
    const p = await mkParticipant("p");
    const pc = await participantCookie(p.id, workshop.id);
    expect((await materialsPost(fileReq(slug, pc, {}), ctx({ slug }))).status).toBe(403);
    const m = await prisma.material.create({ data: { uid: newUid(), workshopId: workshop.id, type: "LINK", title: "x", url: "https://example.com" } });
    expect((await materialDelete(jsonReq(wsUrl(slug, `/materials/${m.id}`), "DELETE", pc), ctx({ slug, materialId: String(m.id) }))).status).toBe(403);
  });

  it("session-scoped material follows session visibility", async () => {
    const { workshop, owner, priv } = await seedWorkshop("PUBLIC");
    const slug = workshop.slug;
    const staff = await userCookie(owner.id);
    await materialsPost(jsonReq(wsUrl(slug, "/materials"), "POST", staff, { title: "非公開回", url: "https://example.com", audience: "EVERYONE", sessionId: priv.id }), ctx({ slug }));
    const anon = (await (await materialsGet(jsonReq(wsUrl(slug, "/materials")), ctx({ slug }))).json()) as { materials: M[] };
    expect(anon.materials).toEqual([]);
  });

  it("deleting a material or workshop removes its file", async () => {
    const { workshop, owner } = await seedWorkshop();
    const slug = workshop.slug;
    const staff = await userCookie(owner.id);
    const a = ((await (await materialsPost(fileReq(slug, staff, {}), ctx({ slug }))).json()) as { material: M }).material;
    const b = ((await (await materialsPost(fileReq(slug, staff, {}), ctx({ slug }))).json()) as { material: M }).material;
    const uidOf = async (id: number) => (await prisma.material.findUniqueOrThrow({ where: { id } })).uid;
    const ua = await uidOf(a.id);
    const ub = await uidOf(b.id);
    expect(existsSync(materialPath(ua))).toBe(true);
    await materialDelete(jsonReq(wsUrl(slug, `/materials/${a.id}`), "DELETE", staff), ctx({ slug, materialId: String(a.id) }));
    expect(existsSync(materialPath(ua))).toBe(false);
    await workshopDelete(jsonReq(wsUrl(slug), "DELETE", staff), ctx({ slug }));
    expect(existsSync(materialPath(ub))).toBe(false);
  });
});

describe("material order", () => {
  it("reorders within one scope and lists workshop-wide materials first", async () => {
    const { workshop, owner, pub } = await seedWorkshop();
    const slug = workshop.slug;
    const staff = await userCookie(owner.id);
    const add = async (title: string, sessionId: number | null) =>
      ((await (await materialsPost(jsonReq(wsUrl(slug, "/materials"), "POST", staff, { title, url: "https://example.com", audience: "EVERYONE", sessionId }), ctx({ slug }))).json()) as { material: M }).material.id;
    const s1 = await add("s1", pub.id);
    const w1 = await add("w1", null);
    const w2 = await add("w2", null);
    const reorder = (sessionId: number | null, ids: number[]) =>
      materialsReorder(jsonReq(wsUrl(slug, "/materials/reorder"), "PATCH", staff, { sessionId, ids }), ctx({ slug }));
    // 対象の全資料と一致しない並びは 400（別の対象の資料を混ぜる・欠ける）
    expect((await reorder(null, [w2])).status).toBe(400);
    expect((await reorder(null, [w2, w1, s1])).status).toBe(400);
    expect((await reorder(null, [w2, w1])).status).toBe(200);
    const titles = ((await (await materialsGet(jsonReq(wsUrl(slug, "/materials")), ctx({ slug }))).json()) as { materials: M[] }).materials.map((m) => m.title);
    expect(titles).toEqual(["w2", "w1", "s1"]);
    // 運営メンバー以外は不可
    const other = await mkUser();
    expect((await materialsReorder(jsonReq(wsUrl(slug, "/materials/reorder"), "PATCH", other.cookie, { sessionId: null, ids: [w1, w2] }), ctx({ slug }))).status).toBe(403);
  });
});

describe("teaching material flag", () => {
  it("staff can set it; the author (participant) cannot", async () => {
    const { workshop, owner, pub, mkParticipant } = await seedWorkshop();
    const p = await mkParticipant("p");
    const project = await prisma.project.create({
      data: { uid: newUid(), workshopId: workshop.id, sessionId: pub.id, participantId: p.id, title: "t", isShared: true },
    });
    const c = ctx({ id: project.uid });
    const url = `http://localhost/3dp/api/projects/${project.uid}`;
    const pc = await participantCookie(p.id, workshop.id);
    expect((await projectPatch(jsonReq(url, "PATCH", pc, { isTeachingMaterial: true }), c)).status).toBe(403);
    // 作者でも、タイトル変更と教材指定を混ぜると 403
    expect((await projectPatch(jsonReq(url, "PATCH", pc, { title: "x", isTeachingMaterial: true }), c)).status).toBe(403);
    expect((await projectPatch(jsonReq(url, "PATCH", await userCookie(owner.id), { isTeachingMaterial: true }), c)).status).toBe(200);
    expect((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).isTeachingMaterial).toBe(true);
    const other = await mkUser();
    expect((await projectPatch(jsonReq(url, "PATCH", other.cookie, { isTeachingMaterial: false }), c)).status).toBe(403);
  });
});
