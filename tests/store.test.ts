import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import { describe, expect, it } from "vitest";
import { GET as getProject, PUT as putProject } from "@/app/api/store/projects/[id]/route";
import { POST as postProject } from "@/app/api/store/workshops/[slug]/projects/route";
import { GET as getThumb } from "@/app/api/projects/[id]/thumbnail/route";
import { prisma } from "@/lib/db";
import { storageRoot } from "./storageRoot";
import { PNG, makeLyl, multipart, participantCookie, userCookie } from "./helpers";
import { seedWorkshop } from "./helpers";
import { strToU8, zipSync } from "fflate";

const base = "http://localhost/3dp/api/store";

function post(slug: string, query: string, form: FormData | null, cookie?: string) {
  return postProject(
    new Request(`${base}/workshops/${slug}/projects?${query}`, { method: "POST", body: form, headers: cookie ? { cookie } : {} }),
    { params: Promise.resolve({ slug }) },
  );
}
function put(id: string, form: FormData, cookie?: string) {
  return putProject(new Request(`${base}/projects/${id}`, { method: "PUT", body: form, headers: cookie ? { cookie } : {} }), {
    params: Promise.resolve({ id }),
  });
}
function get(id: string, cookie?: string) {
  return getProject(new Request(`${base}/projects/${id}`, { headers: cookie ? { cookie } : {} }), { params: Promise.resolve({ id }) });
}

async function setup() {
  const s = await seedWorkshop();
  const alice = await s.mkParticipant("alice");
  const bob = await s.mkParticipant("bob");
  return {
    ...s,
    alice,
    bob,
    aliceCookie: await participantCookie(alice.id, s.workshop.id),
    bobCookie: await participantCookie(bob.id, s.workshop.id),
  };
}

describe("store API", () => {
  it("POST creates a project with title from the .lyl and GET returns the bytes", async () => {
    const t = await setup();
    const lyl = makeLyl("はじめて");
    const res = await post(t.workshop.slug, `sessionId=${t.pub.id}`, multipart({ project: lyl, thumbnail: PNG }), t.aliceCookie);
    expect(res.status).toBe(200);
    const { id, versionTimestamp } = await res.json();
    expect(id).toBeTruthy();
    expect(versionTimestamp).toMatch(/^\d+$/);
    const p = await prisma.project.findUniqueOrThrow({ where: { uid: id } });
    expect(p.title).toBe("はじめて");
    expect(p.participantId).toBe(t.alice.id);
    expect(p.hasThumbnail).toBe(true);

    const got = await get(id, t.aliceCookie);
    expect(got.status).toBe(200);
    expect(got.headers.get("content-type")).toBe("application/vnd.layerling.project+zip");
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(lyl);
  });

  it("requires auth (401) and rejects non-members of a viewable workshop (403)", async () => {
    const t = await setup();
    expect((await post(t.workshop.slug, `sessionId=${t.pub.id}`, multipart({ project: makeLyl() }))).status).toBe(401);
    const org = await prisma.user.create({ data: { email: `x${Date.now()}@example.com`, name: "stranger" } });
    const res = await post(t.workshop.slug, `sessionId=${t.pub.id}`, multipart({ project: makeLyl() }), await userCookie(org.id));
    expect(res.status).toBe(403);
  });

  it("rejects an invalid .lyl (400) and invalid thumbnail (400)", async () => {
    const t = await setup();
    const bad = new Uint8Array(100).fill(7);
    expect((await post(t.workshop.slug, `sessionId=${t.pub.id}`, multipart({ project: bad }), t.aliceCookie)).status).toBe(400);
    const wrongSchema = zipSync({ "project.json": strToU8(JSON.stringify({ schema: "other", formatVersion: 1, minimumReaderVersion: 1 })) });
    expect((await post(t.workshop.slug, `sessionId=${t.pub.id}`, multipart({ project: wrongSchema }), t.aliceCookie)).status).toBe(400);
    const noProject = zipSync({ "x.txt": strToU8("x") });
    expect((await post(t.workshop.slug, `sessionId=${t.pub.id}`, multipart({ project: noProject }), t.aliceCookie)).status).toBe(400);
    const newer = makeLyl("n", "", { minimumReaderVersion: 99 });
    expect((await post(t.workshop.slug, `sessionId=${t.pub.id}`, multipart({ project: newer }), t.aliceCookie)).status).toBe(400);
    const notPng = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect((await post(t.workshop.slug, `sessionId=${t.pub.id}`, multipart({ project: makeLyl(), thumbnail: notPng }), t.aliceCookie)).status).toBe(400);
    expect((await post(t.workshop.slug, `sessionId=${t.pub.id}`, null, t.aliceCookie)).status).toBe(400);
  });

  it("returns 413 over MAX_PROJECT_BYTES and over thumbnail limit", async () => {
    const t = await setup();
    process.env.MAX_PROJECT_BYTES = "1000";
    process.env.MAX_THUMBNAIL_BYTES = "50";
    try {
      const big = makeLyl("big", randomBytes(2500).toString("hex"));
      expect(big.length).toBeGreaterThan(1000);
      expect((await post(t.workshop.slug, `sessionId=${t.pub.id}`, multipart({ project: big }), t.aliceCookie)).status).toBe(413);
      const bigThumb = new Uint8Array(200);
      bigThumb.set(PNG);
      expect((await post(t.workshop.slug, `sessionId=${t.pub.id}`, multipart({ project: makeLyl() , thumbnail: bigThumb }), t.aliceCookie)).status).toBe(413);
    } finally {
      delete process.env.MAX_PROJECT_BYTES;
      delete process.env.MAX_THUMBNAIL_BYTES;
    }
  });

  it("other participant gets 404 on an unshared project (GET and PUT); 403 once shared", async () => {
    const t = await setup();
    const { id } = await (await post(t.workshop.slug, `sessionId=${t.pub.id}`, multipart({ project: makeLyl("a") }), t.aliceCookie)).json();
    expect((await get(id, t.bobCookie)).status).toBe(404);
    expect((await get(id)).status).toBe(404);
    expect((await put(id, multipart({ project: makeLyl("hack") }), t.bobCookie)).status).toBe(404);

    await prisma.project.update({ where: { uid: id }, data: { isShared: true } });
    expect((await get(id, t.bobCookie)).status).toBe(200);
    expect((await get(id)).status).toBe(200); // PUBLIC session + PUBLIC workshop
    expect((await put(id, multipart({ project: makeLyl("hack") }), t.bobCookie)).status).toBe(403);
    expect((await put(id, multipart({ project: makeLyl("hack") }))).status).toBe(401);
    // staff can view but not edit
    expect((await put(id, multipart({ project: makeLyl("hack") }), await userCookie(t.owner.id))).status).toBe(403);
  });

  it("PUT with identical content creates no new version; changed content does; old versions are pruned", async () => {
    const t = await setup();
    const lyl = makeLyl("v1");
    const created = await (await post(t.workshop.slug, `sessionId=${t.pub.id}`, multipart({ project: lyl }), t.aliceCookie)).json();
    const same = await put(created.id, multipart({ project: lyl }), t.aliceCookie);
    expect(same.status).toBe(200);
    expect((await same.json()).versionTimestamp).toBe(created.versionTimestamp);
    const proj = await prisma.project.findUniqueOrThrow({ where: { uid: created.id } });
    expect(await prisma.projectVersion.count({ where: { projectId: proj.id } })).toBe(1);

    const changed = await put(created.id, multipart({ project: makeLyl("v2", "changed") }), t.aliceCookie);
    const cj = await changed.json();
    expect(cj.versionTimestamp).not.toBe(created.versionTimestamp);
    expect(await prisma.projectVersion.count({ where: { projectId: proj.id } })).toBe(2);

    process.env.KEEP_VERSIONS = "3";
    try {
      for (let i = 0; i < 5; i += 1) await put(created.id, multipart({ project: makeLyl("v", `n${i}`) }), t.aliceCookie);
    } finally {
      delete process.env.KEEP_VERSIONS;
    }
    expect(await prisma.projectVersion.count({ where: { projectId: proj.id } })).toBe(3);
    const files = await fs.readdir(`${storageRoot()}/projects/${created.id}`);
    expect(files.filter((f) => f.endsWith(".lyl")).length).toBe(3);
  });

  it("PUT follows a name change made in the editor but keeps a title set on the site", async () => {
    const t = await setup();
    const { id } = await (await post(t.workshop.slug, `sessionId=${t.pub.id}`, multipart({ project: makeLyl("最初") }), t.aliceCookie)).json();
    const title = async () => (await prisma.project.findUniqueOrThrow({ where: { uid: id } })).title;

    expect((await put(id, multipart({ project: makeLyl("改名", "1") }), t.aliceCookie)).status).toBe(200);
    expect(await title()).toBe("改名");

    // サイトでタイトルを変えたあと、エディタの名前が同じままの保存では上書きしない
    await prisma.project.update({ where: { uid: id }, data: { title: "サイトで付けた名前" } });
    expect((await put(id, multipart({ project: makeLyl("改名", "2") }), t.aliceCookie)).status).toBe(200);
    expect(await title()).toBe("サイトで付けた名前");

    // エディタは iframe URL の title で開くので、次の保存ではその名前が届く。タイトルはそのまま
    expect((await put(id, multipart({ project: makeLyl("サイトで付けた名前", "2b") }), t.aliceCookie)).status).toBe(200);
    expect(await title()).toBe("サイトで付けた名前");

    expect((await put(id, multipart({ project: makeLyl("もう一度", "3") }), t.aliceCookie)).status).toBe(200);
    expect(await title()).toBe("もう一度");
  });

  it("remix: originalId places the work in the parent's session and records isRemixOfUid", async () => {
    const t = await setup();
    const parent = await (await post(t.workshop.slug, `sessionId=${t.priv.id}`, multipart({ project: makeLyl("parent") }), t.aliceCookie)).json();
    // Not visible to bob yet -> ignored (not a remix, falls back to requested session)
    const hidden = await (await post(t.workshop.slug, `sessionId=${t.pub.id}&originalId=${parent.id}`, multipart({ project: makeLyl("x") }), t.bobCookie)).json();
    const h = await prisma.project.findUniqueOrThrow({ where: { uid: hidden.id } });
    expect(h.isRemixOfUid).toBeNull();
    expect(h.sessionId).toBe(t.pub.id);

    await prisma.project.update({ where: { uid: parent.id }, data: { isShared: true } });
    const child = await (await post(t.workshop.slug, `sessionId=${t.pub.id}&originalId=${parent.id}&title=${encodeURIComponent("リミックス")}`, multipart({ project: makeLyl("c") }), t.bobCookie)).json();
    const c = await prisma.project.findUniqueOrThrow({ where: { uid: child.id } });
    expect(c.isRemixOfUid).toBe(parent.id);
    expect(c.sessionId).toBe(t.priv.id);
    expect(c.title).toBe("リミックス");
    expect(c.participantId).toBe(t.bob.id);
  });

  it("thumbnail is public for shared works and 404 otherwise", async () => {
    const t = await setup();
    const { id } = await (await post(t.workshop.slug, `sessionId=${t.pub.id}`, multipart({ project: makeLyl(), thumbnail: PNG }), t.aliceCookie)).json();
    const th = (cookie?: string) => getThumb(new Request("http://localhost/x", { headers: cookie ? { cookie } : {} }), { params: Promise.resolve({ id }) });
    expect((await th()).status).toBe(404);
    expect((await th(t.aliceCookie)).status).toBe(200);
    await prisma.project.update({ where: { uid: id }, data: { isShared: true } });
    const anon = await th();
    expect(anon.status).toBe(200);
    expect(anon.headers.get("content-type")).toBe("image/png");
  });

  it("zip bomb style declared sizes are rejected", async () => {
    const t = await setup();
    const lyl = makeLyl("ok");
    // 中央ディレクトリの uncompressed size を巨大値に書き換える
    const v = new DataView(lyl.buffer, lyl.byteOffset, lyl.byteLength);
    for (let i = lyl.length - 22; i >= 0; i -= 1) {
      if (v.getUint32(i, true) === 0x06054b50) {
        const off = v.getUint32(i + 16, true);
        v.setUint32(off + 24, 0xfffffff0, true);
        break;
      }
    }
    expect((await post(t.workshop.slug, `sessionId=${t.pub.id}`, multipart({ project: lyl }), t.aliceCookie)).status).toBe(400);
  });
});
