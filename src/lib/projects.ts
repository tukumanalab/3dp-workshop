import { prisma } from "./db";
import { config } from "./env";
import { newUid, sha256Hex } from "./crypto";
import { isPng, validateLyl, LylError } from "./lyl";
import { removeProjectDir, removeVersionFiles, writeLyl, writeThumb } from "./storage";

export class StoreError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export type ParsedUpload = { lyl: Uint8Array; thumbnail: Uint8Array | null; projectName: string };

/** multipart から project / thumbnail を取り出して検証する。 */
export async function parseUpload(req: Request): Promise<ParsedUpload> {
  const max = config.maxProjectBytes;
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > max + config.maxThumbnailBytes + 1024 * 1024) throw new StoreError("ファイルが大きすぎます", 413);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new StoreError("multipart/form-data が不正です", 400);
  }
  const project = form.get("project");
  if (!(project instanceof File)) throw new StoreError("project フィールドがありません", 400);
  if (project.size > max) throw new StoreError("ファイルが大きすぎます", 413);
  const lyl = new Uint8Array(await project.arrayBuffer());
  let projectName: string;
  try {
    projectName = validateLyl(lyl).projectName;
  } catch (e) {
    if (e instanceof LylError) throw new StoreError(e.message, 400);
    throw new StoreError("不正な .lyl ファイルです", 400);
  }
  let thumbnail: Uint8Array | null = null;
  const t = form.get("thumbnail");
  if (t instanceof File && t.size > 0) {
    if (t.size > config.maxThumbnailBytes) throw new StoreError("サムネイルが大きすぎます", 413);
    thumbnail = new Uint8Array(await t.arrayBuffer());
    if (!isPng(thumbnail)) throw new StoreError("サムネイルは PNG である必要があります", 400);
  }
  return { lyl, thumbnail, projectName };
}

async function uniqueTimestamp(projectId: number): Promise<string> {
  let ts = Date.now();
  for (;;) {
    const exists = await prisma.projectVersion.findUnique({
      where: { projectId_timestamp: { projectId, timestamp: String(ts) } },
      select: { id: true },
    });
    if (!exists) return String(ts);
    ts += 1;
  }
}

/** 版を追加して head を更新し、古い版を刈り込む。 */
export async function addVersion(
  project: { id: number; uid: string },
  upload: ParsedUpload,
): Promise<{ versionTimestamp: string }> {
  const ts = await uniqueTimestamp(project.id);
  const sha = sha256Hex(upload.lyl);
  await writeLyl(project.uid, ts, upload.lyl);
  if (upload.thumbnail) await writeThumb(project.uid, ts, upload.thumbnail);
  await prisma.$transaction([
    prisma.projectVersion.create({
      data: { projectId: project.id, timestamp: ts, sizeBytes: upload.lyl.length, sha256: sha, hasThumbnail: !!upload.thumbnail },
    }),
    prisma.project.update({
      where: { id: project.id },
      data: {
        headVersionTs: ts,
        headSha256: sha,
        sizeBytes: upload.lyl.length,
        ...(upload.thumbnail ? { hasThumbnail: true } : {}),
      },
    }),
  ]);
  await pruneVersions(project);
  return { versionTimestamp: ts };
}

export async function pruneVersions(project: { id: number; uid: string }) {
  const versions = await prisma.projectVersion.findMany({
    where: { projectId: project.id },
    orderBy: { id: "desc" },
    select: { id: true, timestamp: true },
  });
  const old = versions.slice(config.keepVersions);
  for (const v of old) {
    await removeVersionFiles(project.uid, v.timestamp);
    await prisma.projectVersion.delete({ where: { id: v.id } });
  }
}

export async function createProject(args: {
  workshopId: number;
  sessionId: number;
  participantId: number | null;
  userId: number | null;
  title: string;
  isShared: boolean;
  isRemixOfUid: string | null;
  upload: ParsedUpload;
}): Promise<{ id: string; versionTimestamp: string }> {
  const uid = newUid();
  const project = await prisma.project.create({
    data: {
      uid,
      workshopId: args.workshopId,
      sessionId: args.sessionId,
      participantId: args.participantId,
      userId: args.userId,
      title: args.title.slice(0, 200) || "無題",
      isShared: args.isShared,
      isRemixOfUid: args.isRemixOfUid,
    },
  });
  try {
    const { versionTimestamp } = await addVersion(project, args.upload);
    return { id: uid, versionTimestamp };
  } catch (e) {
    await prisma.project.delete({ where: { id: project.id } }).catch(() => undefined);
    await removeProjectDir(uid);
    throw e;
  }
}

/** PUT: 内容が head と同一なら版を作らず既存のタイムスタンプを返す。 */
export async function saveProjectContent(
  project: { id: number; uid: string; headSha256: string | null; headVersionTs: string | null },
  upload: ParsedUpload,
): Promise<{ id: string; versionTimestamp: string }> {
  if (project.headVersionTs && project.headSha256 === sha256Hex(upload.lyl)) {
    return { id: project.uid, versionTimestamp: project.headVersionTs };
  }
  const { versionTimestamp } = await addVersion(project, upload);
  return { id: project.uid, versionTimestamp };
}

export async function deleteProject(project: { id: number; uid: string }) {
  await prisma.project.delete({ where: { id: project.id } });
  await removeProjectDir(project.uid);
}
