import { promises as fs } from "fs";
import path from "path";
import { config } from "./env";

const safeSegment = (s: string) => {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error("invalid path segment");
  return s;
};

export const projectDir = (uid: string) => path.join(config.storageDir, "projects", safeSegment(uid));
export const lylPath = (uid: string, ts: string) => path.join(projectDir(uid), `${safeSegment(ts)}.lyl`);
export const thumbPath = (uid: string, ts: string) => path.join(projectDir(uid), "thumbnails", `${safeSegment(ts)}.png`);

async function writeAtomic(file: string, data: Uint8Array) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, file);
}

export const writeLyl = (uid: string, ts: string, data: Uint8Array) => writeAtomic(lylPath(uid, ts), data);
export const writeThumb = (uid: string, ts: string, data: Uint8Array) => writeAtomic(thumbPath(uid, ts), data);

export async function readLyl(uid: string, ts: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(lylPath(uid, ts));
  } catch {
    return null;
  }
}

export async function readThumb(uid: string, ts: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(thumbPath(uid, ts));
  } catch {
    return null;
  }
}

export async function removeVersionFiles(uid: string, ts: string) {
  await fs.rm(lylPath(uid, ts), { force: true });
  await fs.rm(thumbPath(uid, ts), { force: true });
}

export async function removeProjectDir(uid: string) {
  await fs.rm(projectDir(uid), { recursive: true, force: true });
}

export const materialPath = (uid: string) => path.join(config.storageDir, "materials", safeSegment(uid));
export const writeMaterial = (uid: string, data: Uint8Array) => writeAtomic(materialPath(uid), data);

export async function readMaterial(uid: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(materialPath(uid));
  } catch {
    return null;
  }
}

export async function removeMaterial(uid: string) {
  await fs.rm(materialPath(uid), { force: true });
}
