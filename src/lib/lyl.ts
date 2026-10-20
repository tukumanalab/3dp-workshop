import { strFromU8, unzipSync } from "fflate";

export const LYL_MEDIA_TYPE = "application/vnd.layerling.project+zip";
const SCHEMAS = new Set(["com.layerling.project", "com.sketchforge.project"]);
const MAX_ENTRIES = 4096;
const MAX_EXPANDED_BYTES = 1024 * 1024 * 1024; // 申告展開サイズの合計上限
const MAX_PROJECT_JSON_BYTES = 64 * 1024 * 1024;
const SUPPORTED_READER_VERSION = 2;

export class LylError extends Error {}

export type LylSummary = { projectName: string; formatVersion: number };

/** ZIP 先頭の EOCD から中央ディレクトリを走査し、申告サイズを検査する（展開はしない）。 */
function inspectDirectory(bytes: Uint8Array): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new LylError("ZIP ファイルではありません");
  const count = view.getUint16(eocd + 10, true);
  const dirSize = view.getUint32(eocd + 12, true);
  const dirOffset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || dirSize === 0xffffffff || dirOffset === 0xffffffff) throw new LylError("ZIP64 は未対応です");
  if (count === 0 || count > MAX_ENTRIES) throw new LylError("ファイル数が不正です");
  if (dirOffset + dirSize > bytes.length) throw new LylError("ZIP ディレクトリが壊れています");
  let off = dirOffset;
  let expanded = 0;
  for (let i = 0; i < count; i += 1) {
    if (off + 46 > bytes.length || view.getUint32(off, true) !== 0x02014b50) throw new LylError("ZIP ディレクトリが壊れています");
    if (view.getUint16(off + 8, true) & 1) throw new LylError("暗号化された ZIP は未対応です");
    expanded += view.getUint32(off + 24, true);
    const n = view.getUint16(off + 28, true);
    const e = view.getUint16(off + 30, true);
    const c = view.getUint16(off + 32, true);
    off += 46 + n + e + c;
  }
  if (expanded > MAX_EXPANDED_BYTES) throw new LylError("展開後サイズが上限を超えています");
}

/**
 * .lyl（ZIP）を検証する。project.json だけを展開し、アセットは展開しない。
 * schema / formatVersion / minimumReaderVersion を確認して projectName を返す。
 */
export function validateLyl(bytes: Uint8Array): LylSummary {
  if (bytes.length < 22) throw new LylError(".lyl ファイルが空または小さすぎます");
  inspectDirectory(bytes);
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f) => {
        if (f.name !== "project.json") return false;
        if (f.originalSize > MAX_PROJECT_JSON_BYTES) throw new LylError("project.json が大きすぎます");
        return true;
      },
    });
  } catch (e) {
    if (e instanceof LylError) throw e;
    throw new LylError("ZIP を開けません");
  }
  const raw = files["project.json"];
  if (!raw) throw new LylError("project.json がありません");
  let doc: unknown;
  try {
    doc = JSON.parse(strFromU8(raw));
  } catch {
    throw new LylError("project.json の JSON が不正です");
  }
  if (!doc || typeof doc !== "object") throw new LylError("project.json が不正です");
  const d = doc as Record<string, unknown>;
  if (typeof d.schema !== "string" || !SCHEMAS.has(d.schema)) throw new LylError("Layerling のプロジェクトではありません");
  if (d.formatVersion !== 1 && d.formatVersion !== 2) throw new LylError("未対応の formatVersion です");
  if (typeof d.minimumReaderVersion !== "number" || !Number.isInteger(d.minimumReaderVersion) || d.minimumReaderVersion > SUPPORTED_READER_VERSION) {
    throw new LylError("より新しい Layerling が必要なプロジェクトです");
  }
  const meta = d.metadata as Record<string, unknown> | undefined;
  const name = meta && typeof meta.projectName === "string" ? meta.projectName.trim() : "";
  return { projectName: name || "layerling design", formatVersion: d.formatVersion };
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
export const isPng = (b: Uint8Array): boolean => b.length > 8 && PNG_SIGNATURE.every((v, i) => b[i] === v);
