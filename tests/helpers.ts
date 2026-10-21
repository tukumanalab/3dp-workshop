import { strToU8, zipSync } from "fflate";
import { prisma } from "@/lib/db";
import { hashSecret, newUid } from "@/lib/crypto";
import { makeParticipantCookie, makeUserCookie } from "@/lib/session";

export function makeLyl(name = "テスト", extra = "", overrides: Record<string, unknown> = {}): Uint8Array {
  const doc = {
    schema: "com.layerling.project",
    formatVersion: 2,
    minimumReaderVersion: 1,
    metadata: { projectName: name, createdAt: "2026-01-01T00:00:00Z", modifiedAt: "2026-01-01T00:00:00Z" },
    extra,
    ...overrides,
  };
  return zipSync({ "project.json": strToU8(JSON.stringify(doc)) });
}

export const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

export function multipart(opts: { project?: Uint8Array | null; thumbnail?: Uint8Array | null }): FormData {
  const f = new FormData();
  if (opts.project) f.set("project", new File([opts.project as BlobPart], "p.lyl", { type: "application/vnd.layerling.project+zip" }));
  if (opts.thumbnail) f.set("thumbnail", new File([opts.thumbnail as BlobPart], "t.png", { type: "image/png" }));
  return f;
}

export async function cookieHeader(c: { name: string; value: string }[]) {
  return c.map((x) => `${x.name}=${encodeURIComponent(x.value)}`).join("; ");
}

export async function participantCookie(participantId: number, workshopId: number) {
  const c = await makeParticipantCookie({ participantId, workshopId });
  return `${c.name}=${encodeURIComponent(c.value)}`;
}

export async function userCookie(userId: number, role = "organizer") {
  const c = await makeUserCookie({ userId, role });
  return `${c.name}=${encodeURIComponent(c.value)}`;
}

let counter = 0;
export async function seedWorkshop(visibility = "PUBLIC") {
  counter += 1;
  const owner = await prisma.user.create({ data: { email: `owner${counter}-${newUid()}@example.com`, name: "Owner" } });
  const w = await prisma.workshop.create({
    data: {
      uid: newUid(),
      slug: `ws-${counter}-${newUid().slice(0, 4)}`,
      title: "WS",
      visibility,
      joinCode: newUid().toUpperCase(),
      ownerId: owner.id,
      sessions: { create: [{ name: "A", visibility: "PUBLIC", order: 0 }, { name: "B", visibility: "PRIVATE", order: 1 }] },
    },
    include: { sessions: { orderBy: { order: "asc" } } },
  });
  const [pub, priv] = w.sessions as [(typeof w.sessions)[0], (typeof w.sessions)[0]];
  const mkParticipant = async (displayName: string, pin?: string) =>
    prisma.participant.create({
      data: { workshopId: w.id, loginId: newUid().slice(0, 6), displayName, pinHash: pin ? hashSecret(pin) : null },
    });
  return { owner, workshop: w, pub, priv, mkParticipant };
}

/** DB の role / status と cookie の role を揃えたユーザーを作る。cookie も返す。 */
export async function mkUser(role: "admin" | "organizer" = "organizer", status: "APPROVED" | "SUSPENDED" = "APPROVED") {
  counter += 1;
  const user = await prisma.user.create({
    data: { email: `u${counter}-${newUid()}@example.com`, name: `User${counter}`, role, status },
  });
  return { user, cookie: await userCookie(user.id, role) };
}
