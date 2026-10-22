import { prisma } from "./db";
import { config } from "./env";
import { newUid } from "./crypto";
import { removeMaterial, writeMaterial } from "./storage";
import { canViewMaterial, isMaterialAudience, type MaterialAudience, type Viewer, type WorkshopForAccess } from "./access";

export const MATERIAL_TITLE_MAX = 100;

export class MaterialError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export type MaterialRow = Awaited<ReturnType<typeof prisma.material.findMany>>[number];

export const materialFileUrl = (slug: string, id: number) => `/3dp-workshop/api/workshops/${slug}/materials/${id}/file`;

export function serializeMaterial(slug: string, m: MaterialRow) {
  return {
    id: m.id,
    sessionId: m.sessionId,
    type: m.type,
    title: m.title,
    url: m.type === "LINK" ? m.url : materialFileUrl(slug, m.id),
    fileName: m.fileName,
    byteSize: m.byteSize,
    audience: m.audience,
    order: m.order,
  };
}

/** 閲覧者に見える資料だけを返す（ワークショップ全体の資料 → セッションの資料、それぞれ order 順）。 */
export async function listVisibleMaterials(
  w: WorkshopForAccess & { slug: string },
  sessions: { id: number; workshopId: number; visibility: string }[],
  viewer: Viewer,
) {
  const all = await prisma.material.findMany({ where: { workshopId: w.id }, orderBy: [{ order: "asc" }, { id: "asc" }] });
  all.sort((a, b) => Number(a.sessionId !== null) - Number(b.sessionId !== null));
  return all.filter((m) => {
    const s = m.sessionId === null ? null : sessions.find((x) => x.id === m.sessionId);
    if (s === undefined) return false;
    return canViewMaterial(w, s, m, viewer);
  });
}

function parseLinkUrl(v: unknown): string {
  if (typeof v !== "string") throw new MaterialError("URL を入力してください", 400);
  let u: URL;
  try {
    u = new URL(v.trim());
  } catch {
    throw new MaterialError("URL が不正です", 400);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new MaterialError("http または https の URL を入力してください", 400);
  return u.toString();
}

function parseTitle(v: unknown, fallback = ""): string {
  const t = (typeof v === "string" ? v : fallback).trim();
  if (!t || t.length > MATERIAL_TITLE_MAX) throw new MaterialError(`タイトルは 1〜${MATERIAL_TITLE_MAX} 文字です`, 400);
  return t;
}

function parseAudience(v: unknown): MaterialAudience {
  if (v === undefined || v === null || v === "") return "PARTICIPANT";
  if (!isMaterialAudience(v)) throw new MaterialError("公開範囲が不正です", 400);
  return v;
}

async function parseSessionId(workshopId: number, v: unknown): Promise<number | null> {
  if (v === undefined || v === null || v === "") return null;
  const s = await prisma.session.findFirst({ where: { id: Number(v) || -1, workshopId } });
  if (!s) throw new MaterialError("セッションが見つかりません", 400);
  return s.id;
}

async function nextOrder(workshopId: number, sessionId: number | null) {
  const last = await prisma.material.findFirst({ where: { workshopId, sessionId }, orderBy: { order: "desc" } });
  return (last?.order ?? -1) + 1;
}

/** multipart（file, title, sessionId?, audience?）または JSON の LINK（title, url, sessionId?, audience?）から資料を作る。 */
export async function createMaterialFromRequest(workshopId: number, req: Request) {
  const type = req.headers.get("content-type") ?? "";
  if (type.startsWith("multipart/form-data")) {
    const declared = Number(req.headers.get("content-length") || 0);
    if (declared > config.maxMaterialBytes + 1024 * 1024) throw new MaterialError("ファイルが大きすぎます", 413);
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new MaterialError("リクエストが不正です", 400);
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new MaterialError("ファイルを選んでください", 400);
    if (file.size > config.maxMaterialBytes) throw new MaterialError("ファイルが大きすぎます", 413);
    const fileName = file.name.slice(0, 200) || "file";
    const title = parseTitle(form.get("title"), fileName);
    const audience = parseAudience(form.get("audience"));
    const sessionId = await parseSessionId(workshopId, form.get("sessionId"));
    const uid = newUid();
    await writeMaterial(uid, new Uint8Array(await file.arrayBuffer()));
    try {
      return await prisma.material.create({
        data: {
          uid,
          workshopId,
          sessionId,
          type: "FILE",
          title,
          fileName,
          mimeType: file.type || "application/octet-stream",
          byteSize: file.size,
          audience,
          order: await nextOrder(workshopId, sessionId),
        },
      });
    } catch (e) {
      await removeMaterial(uid);
      throw e;
    }
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    throw new MaterialError("リクエストが不正です", 400);
  }
  const sessionId = await parseSessionId(workshopId, body.sessionId);
  return prisma.material.create({
    data: {
      uid: newUid(),
      workshopId,
      sessionId,
      type: "LINK",
      title: parseTitle(body.title),
      url: parseLinkUrl(body.url),
      audience: parseAudience(body.audience),
      order: await nextOrder(workshopId, sessionId),
    },
  });
}

/** PATCH { title?, audience?, sessionId?, url?(LINK のみ), order? } */
export async function updateMaterial(m: MaterialRow, body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = parseTitle(body.title);
  if (body.audience !== undefined) data.audience = parseAudience(body.audience);
  if (body.sessionId !== undefined) {
    data.sessionId = await parseSessionId(m.workshopId, body.sessionId);
    if (data.sessionId !== m.sessionId) data.order = await nextOrder(m.workshopId, data.sessionId as number | null);
  }
  if (body.url !== undefined) {
    if (m.type !== "LINK") throw new MaterialError("ファイル資料の URL は変更できません", 400);
    data.url = parseLinkUrl(body.url);
  }
  if (typeof body.order === "number" && Number.isInteger(body.order)) data.order = body.order;
  return prisma.material.update({ where: { id: m.id }, data });
}

/** 1 つの対象（sessionId null = ワークショップ全体）の資料を ids の順に並べ替える。ids がその対象の全資料と一致しなければ false。 */
export async function reorderMaterials(workshopId: number, sessionId: number | null, ids: unknown[]): Promise<boolean> {
  const current = await prisma.material.findMany({ where: { workshopId, sessionId }, select: { id: true } });
  const same =
    ids.length === current.length && new Set(ids).size === ids.length && current.every((m) => ids.includes(m.id));
  if (!same) return false;
  await prisma.$transaction(ids.map((id, order) => prisma.material.update({ where: { id: id as number }, data: { order } })));
  return true;
}

export async function deleteMaterial(m: { id: number; uid: string; type: string }) {
  await prisma.material.delete({ where: { id: m.id } });
  if (m.type === "FILE") await removeMaterial(m.uid);
}

/** ワークショップ・セッション削除の前に呼び、Cascade で消える資料のファイルを集める。 */
export async function materialFileUids(where: { workshopId?: number; sessionId?: number }) {
  const rows = await prisma.material.findMany({ where: { ...where, type: "FILE" }, select: { uid: true } });
  return rows.map((r) => r.uid);
}

export async function removeMaterialFiles(uids: string[]) {
  for (const uid of uids) await removeMaterial(uid);
}
