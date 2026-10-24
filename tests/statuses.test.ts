import { describe, expect, it } from "vitest";
import { GET as labelsGet, POST as labelsPost } from "@/app/api/workshops/[slug]/status-labels/route";
import { DELETE as labelDelete, PATCH as labelPatch } from "@/app/api/workshops/[slug]/status-labels/[labelId]/route";
import { PATCH as labelsReorder } from "@/app/api/workshops/[slug]/status-labels/reorder/route";
import { GET as projectGet, PATCH as projectPatch } from "@/app/api/projects/[id]/route";
import { GET as digestGet } from "@/app/api/workshops/[slug]/projects/digest/route";
import { prisma } from "@/lib/db";
import { newUid } from "@/lib/crypto";
import { listProjectsForViewer } from "@/lib/gallery";
import {
  activeStatusFilter,
  filterProjectsByStatus,
  parseStatusFilter,
  toggleStatusFilter,
  type StatusLabelView,
} from "@/lib/statuses";
import { participantCookie, seedWorkshop, userCookie } from "./helpers";
import { ctx, jsonReq, wsUrl } from "./workshopReq";

type L = StatusLabelView;
type PS = { labelId: number; optionId: number; labelName: string; optionName: string };
const projectUrl = (uid: string) => `http://localhost/3dp/api/projects/${uid}`;

async function setup() {
  const s = await seedWorkshop("PUBLIC");
  const slug = s.workshop.slug;
  const staff = await userCookie(s.owner.id);
  const mkLabel = async (name: string, options: string[]) => {
    const res = await labelsPost(jsonReq(wsUrl(slug, "/status-labels"), "POST", staff, { name, options }), ctx({ slug }));
    expect(res.status).toBe(201);
    return ((await res.json()) as { label: L }).label;
  };
  const mkProject = async (participantId: number, title = "作品") =>
    prisma.project.create({
      data: { uid: newUid(), workshopId: s.workshop.id, sessionId: s.pub.id, participantId, title, isShared: true },
    });
  return { ...s, slug, staff, mkLabel, mkProject };
}

const patchStatuses = (uid: string, cookie: string | undefined, statuses: unknown) =>
  projectPatch(jsonReq(projectUrl(uid), "PATCH", cookie, { statuses }), ctx({ id: uid }));

describe("status labels API", () => {
  it("staff create, rename, reorder and delete labels; others cannot", async () => {
    const { slug, staff, workshop, mkParticipant, mkLabel } = await setup();
    const pc = await participantCookie((await mkParticipant("p")).id, workshop.id);
    const url = wsUrl(slug, "/status-labels");

    expect((await labelsPost(jsonReq(url, "POST", pc, { name: "x", options: ["a"] }), ctx({ slug }))).status).toBe(403);
    expect((await labelsPost(jsonReq(url, "POST", undefined, { name: "x", options: ["a"] }), ctx({ slug }))).status).toBe(403);
    // オプション無し・重複・長すぎる名前は 400
    expect((await labelsPost(jsonReq(url, "POST", staff, { name: "x", options: [] }), ctx({ slug }))).status).toBe(400);
    expect((await labelsPost(jsonReq(url, "POST", staff, { name: "x", options: ["a", "a"] }), ctx({ slug }))).status).toBe(400);
    expect((await labelsPost(jsonReq(url, "POST", staff, { name: "x".repeat(31), options: ["a"] }), ctx({ slug }))).status).toBe(400);

    const progress = await mkLabel("進捗", ["作成中", "完成"]);
    const print = await mkLabel("印刷", ["未印刷", "印刷済み"]);
    expect(progress.options.map((o) => o.name)).toEqual(["作成中", "完成"]);

    // 誰でも一覧を見られる（ワークショップが見えるなら）
    const list = async () => ((await (await labelsGet(jsonReq(url), ctx({ slug }))).json()) as { labels: L[] }).labels;
    expect((await list()).map((l) => l.name)).toEqual(["進捗", "印刷"]);

    const reorder = (cookie: string, ids: unknown) => labelsReorder(jsonReq(wsUrl(slug, "/status-labels/reorder"), "PATCH", cookie, { ids }), ctx({ slug }));
    expect((await reorder(pc, [print.id, progress.id])).status).toBe(403);
    expect((await reorder(staff, [print.id])).status).toBe(400);
    expect((await reorder(staff, [print.id, progress.id])).status).toBe(200);
    expect((await list()).map((l) => l.name)).toEqual(["印刷", "進捗"]);

    // オプションの改名・並べ替え・追加・削除（全置換）
    const [making, done] = progress.options;
    const lp = (cookie: string, body: unknown) =>
      labelPatch(jsonReq(wsUrl(slug, `/status-labels/${progress.id}`), "PATCH", cookie, body), ctx({ slug, labelId: String(progress.id) }));
    expect((await lp(pc, { name: "x" })).status).toBe(403);
    expect((await lp(staff, { options: [{ id: 999999, name: "x" }] })).status).toBe(400);
    expect((await lp(staff, { options: [{ id: print.options[0]!.id, name: "x" }] })).status).toBe(400);
    const res = await lp(staff, { name: "進み具合", options: [{ id: done!.id, name: "できた" }, { name: "確認中" }] });
    expect(res.status).toBe(200);
    const updated = ((await res.json()) as { label: L }).label;
    expect(updated.name).toBe("進み具合");
    expect(updated.options.map((o) => o.name)).toEqual(["できた", "確認中"]);
    expect(updated.options[0]!.id).toBe(done!.id);
    expect(await prisma.statusOption.findUnique({ where: { id: making!.id } })).toBeNull();

    const del = (cookie: string) =>
      labelDelete(jsonReq(wsUrl(slug, `/status-labels/${print.id}`), "DELETE", cookie), ctx({ slug, labelId: String(print.id) }));
    expect((await del(pc)).status).toBe(403);
    expect((await del(staff)).status).toBe(200);
    expect((await list()).map((l) => l.name)).toEqual(["進み具合"]);
  });

  it("labels of another workshop are not found", async () => {
    const a = await setup();
    const b = await setup();
    const label = await a.mkLabel("進捗", ["作成中"]);
    const res = await labelPatch(
      jsonReq(wsUrl(b.slug, `/status-labels/${label.id}`), "PATCH", b.staff, { name: "x" }),
      ctx({ slug: b.slug, labelId: String(label.id) }),
    );
    expect(res.status).toBe(404);
  });
});

describe("project statuses API", () => {
  it("author and staff set one option per label; other participants cannot", async () => {
    const { workshop, staff, mkParticipant, mkLabel, mkProject } = await setup();
    const progress = await mkLabel("進捗", ["作成中", "完成"]);
    const print = await mkLabel("印刷", ["未印刷", "印刷済み"]);
    const author = await mkParticipant("作者");
    const ac = await participantCookie(author.id, workshop.id);
    const oc = await participantCookie((await mkParticipant("他の人")).id, workshop.id);
    const p = await mkProject(author.id);
    const before = p.updatedAt;
    const [making, done] = progress.options;
    const [notYet, printed] = print.options;

    expect((await patchStatuses(p.uid, oc, [making!.id])).status).toBe(403);
    expect((await patchStatuses(p.uid, undefined, [making!.id])).status).toBe(403);
    // 同じ種類から 2 つ・存在しないオプション・配列以外は 400
    expect((await patchStatuses(p.uid, ac, [making!.id, done!.id])).status).toBe(400);
    expect((await patchStatuses(p.uid, ac, [999999])).status).toBe(400);
    expect((await patchStatuses(p.uid, ac, "x")).status).toBe(400);

    expect((await patchStatuses(p.uid, ac, [making!.id, notYet!.id])).status).toBe(200);
    // スタッフは他人の作品も変更できる
    expect((await patchStatuses(p.uid, staff, [done!.id, printed!.id])).status).toBe(200);

    const got = (await (await projectGet(jsonReq(projectUrl(p.uid)), ctx({ id: p.uid }))).json()) as { project: { statuses: PS[] } };
    expect(got.project.statuses.map((s) => `${s.labelName}:${s.optionName}`)).toEqual(["進捗:完成", "印刷:印刷済み"]);
    // 状態だけの変更では更新日時を動かさない
    expect((await prisma.project.findUniqueOrThrow({ where: { id: p.id } })).updatedAt).toEqual(before);

    // 空配列で全部外す
    expect((await patchStatuses(p.uid, ac, [])).status).toBe(200);
    expect(await prisma.projectStatus.count({ where: { projectId: p.id } })).toBe(0);
  });

  it("options of another workshop are rejected", async () => {
    const a = await setup();
    const b = await setup();
    const foreign = await b.mkLabel("進捗", ["作成中"]);
    await a.mkLabel("進捗", ["作成中"]);
    const p = await a.mkProject((await a.mkParticipant("p")).id);
    expect((await patchStatuses(p.uid, a.staff, [foreign.options[0]!.id])).status).toBe(400);
  });

  it("authors can change statuses after the workshop closes", async () => {
    const { workshop, mkParticipant, mkLabel, mkProject } = await setup();
    const label = await mkLabel("進捗", ["作成中"]);
    const author = await mkParticipant("作者");
    const p = await mkProject(author.id);
    await prisma.workshop.update({ where: { id: workshop.id }, data: { isOpen: false } });
    const ac = await participantCookie(author.id, workshop.id);
    expect((await patchStatuses(p.uid, ac, [label.options[0]!.id])).status).toBe(200);
    // タイトルの変更は従来どおり不可
    expect((await projectPatch(jsonReq(projectUrl(p.uid), "PATCH", ac, { title: "x" }), ctx({ id: p.uid }))).status).toBe(403);
  });

  it("deleting a label or option removes it from projects and gallery cards", async () => {
    const { slug, workshop, staff, mkParticipant, mkLabel, mkProject } = await setup();
    const progress = await mkLabel("進捗", ["作成中", "完成"]);
    const print = await mkLabel("印刷", ["未印刷"]);
    const p = await mkProject((await mkParticipant("p")).id);
    await patchStatuses(p.uid, staff, [progress.options[0]!.id, print.options[0]!.id]);

    const w = await prisma.workshop.findUniqueOrThrow({ where: { id: workshop.id }, include: { staff: true } });
    const cards = async () => (await listProjectsForViewer(w, { participants: [] }))!;
    expect((await cards())[0]!.statuses.map((s) => s.optionName)).toEqual(["作成中", "未印刷"]);

    await labelDelete(jsonReq(wsUrl(slug, `/status-labels/${print.id}`), "DELETE", staff), ctx({ slug, labelId: String(print.id) }));
    await labelPatch(
      jsonReq(wsUrl(slug, `/status-labels/${progress.id}`), "PATCH", staff, { options: [{ id: progress.options[1]!.id, name: "完成" }] }),
      ctx({ slug, labelId: String(progress.id) }),
    );
    expect((await cards())[0]!.statuses).toEqual([]);
    expect(await prisma.projectStatus.count({ where: { projectId: p.id } })).toBe(0);
  });
});

describe("projects digest API", () => {
  const digest = async (slug: string, cookie?: string) => {
    const res = await digestGet(jsonReq(wsUrl(slug, "/projects/digest"), "GET", cookie), ctx({ slug }));
    expect(res.status).toBe(200);
    return ((await res.json()) as { digest: string }).digest;
  };

  it("changes when a visible project's status or option name changes", async () => {
    const { slug, staff, mkParticipant, mkLabel, mkProject } = await setup();
    const label = await mkLabel("進捗", ["作成中", "完成"]);
    const p = await mkProject((await mkParticipant("p")).id);
    const d0 = await digest(slug);
    expect(await digest(slug)).toBe(d0);
    await patchStatuses(p.uid, staff, [label.options[0]!.id]);
    const d1 = await digest(slug);
    expect(d1).not.toBe(d0);
    await labelPatch(
      jsonReq(wsUrl(slug, `/status-labels/${label.id}`), "PATCH", staff, { options: [{ id: label.options[0]!.id, name: "つくり中" }] }),
      ctx({ slug, labelId: String(label.id) }),
    );
    expect(await digest(slug)).not.toBe(d1);
  });

  it("does not leak changes of projects the viewer cannot see", async () => {
    const { slug, staff, workshop, mkParticipant, mkLabel, mkProject } = await setup();
    const label = await mkLabel("進捗", ["作成中"]);
    const p = await mkProject((await mkParticipant("p")).id);
    await prisma.project.update({ where: { id: p.id }, data: { isShared: false } });
    const anon = await digest(slug);
    const asStaff = await digest(slug, staff);
    await patchStatuses(p.uid, staff, [label.options[0]!.id]);
    expect(await digest(slug)).toBe(anon);
    expect(await digest(slug, staff)).not.toBe(asStaff);
    // 見えないワークショップは 404
    await prisma.workshop.update({ where: { id: workshop.id }, data: { visibility: "PRIVATE" } });
    expect((await digestGet(jsonReq(wsUrl(slug, "/projects/digest")), ctx({ slug }))).status).toBe(404);
  });
});

describe("status filter", () => {
  const labels: L[] = [
    { id: 1, name: "進捗", options: [{ id: 11, name: "作成中" }, { id: 12, name: "完成" }] },
    { id: 2, name: "印刷", options: [{ id: 21, name: "未印刷" }, { id: 22, name: "印刷済み" }] },
  ];
  const card = (id: string, ...optionIds: number[]) => ({
    id,
    statuses: optionIds.map((o) => ({ labelId: Math.floor(o / 10), optionId: o })),
  });
  const cards = [card("a", 11, 21), card("b", 12, 22), card("c", 12), card("d")];
  const ids = (tokens: string[]) => filterProjectsByStatus(cards, labels, tokens).map((c) => c.id);

  it("ORs within a label and ANDs across labels", () => {
    expect(ids([])).toEqual(["a", "b", "c", "d"]);
    expect(ids(["12"])).toEqual(["b", "c"]);
    expect(ids(["11", "12"])).toEqual(["a", "b", "c"]);
    expect(ids(["12", "22"])).toEqual(["b"]);
  });

  it("matches unset labels with none:<labelId>", () => {
    expect(ids(["none:2"])).toEqual(["c", "d"]);
    expect(ids(["12", "none:2"])).toEqual(["c"]);
    expect(ids(["none:1", "21"])).toEqual([]);
  });

  it("ignores unknown or malformed tokens", () => {
    expect(parseStatusFilter("11,abc,none:2,none:x,,11,-1")).toEqual(["11", "none:2"]);
    expect(parseStatusFilter(undefined)).toEqual([]);
    expect(activeStatusFilter(labels, ["99", "none:9", "22"])).toEqual(["22"]);
    expect(ids(["99"])).toEqual(["a", "b", "c", "d"]);
  });

  it("toggles tokens and keeps the defined order", () => {
    expect(toggleStatusFilter(labels, ["22"], "11")).toEqual(["11", "22"]);
    expect(toggleStatusFilter(labels, ["11", "22"], "11")).toEqual(["22"]);
    expect(toggleStatusFilter(labels, [], "none:1")).toEqual(["none:1"]);
  });
});
