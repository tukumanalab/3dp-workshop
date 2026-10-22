import { prisma } from "./db";
import { hashSecret, newLoginId } from "./crypto";

export const PIN_RE = /^\d{4}$/;
export const LOGIN_ID_RE = /^[a-z0-9_-]{2,32}$/;
export const DISPLAY_NAME_MAX = 40;
export const BULK_MAX = 200;

/** ワークショップ内で未使用のログイン ID を発行する。 */
export async function allocateLoginId(workshopId: number): Promise<string> {
  let loginId = newLoginId();
  for (let i = 0; i < 5 && (await prisma.participant.findUnique({ where: { workshopId_loginId: { workshopId, loginId } } })); i += 1) {
    loginId = newLoginId();
  }
  return loginId;
}

export type ParticipantInput = { displayName?: unknown; loginId?: unknown; pin?: unknown };
export type BulkResult = {
  created: { loginId: string; displayName: string; pin: string | null }[];
  skipped: { line: number; reason: string }[];
};

/** staff による事前登録。不正・重複の行はスキップして理由を返す（line は 1 始まり）。 */
export async function registerParticipants(workshopId: number, rows: ParticipantInput[]): Promise<BulkResult> {
  const result: BulkResult = { created: [], skipped: [] };
  const seen = new Set<string>();
  for (const [i, row] of rows.entries()) {
    const line = i + 1;
    const displayName = typeof row.displayName === "string" ? row.displayName.trim() : "";
    if (!displayName || displayName.length > DISPLAY_NAME_MAX) {
      result.skipped.push({ line, reason: `表示名は 1〜${DISPLAY_NAME_MAX} 文字です` });
      continue;
    }
    const pin = typeof row.pin === "string" ? row.pin.trim() : "";
    if (pin && !PIN_RE.test(pin)) {
      result.skipped.push({ line, reason: "PIN は 4 桁の数字です" });
      continue;
    }
    let loginId = typeof row.loginId === "string" ? row.loginId.trim().toLowerCase() : "";
    if (loginId) {
      if (!LOGIN_ID_RE.test(loginId)) {
        result.skipped.push({ line, reason: "ログイン ID は英数字・_・- の 2〜32 文字です" });
        continue;
      }
      const dup = seen.has(loginId) || (await prisma.participant.findUnique({ where: { workshopId_loginId: { workshopId, loginId } } }));
      if (dup) {
        result.skipped.push({ line, reason: `ログイン ID「${loginId}」は使われています` });
        continue;
      }
    } else {
      loginId = await allocateLoginId(workshopId);
    }
    seen.add(loginId);
    await prisma.participant.create({ data: { workshopId, loginId, displayName, pinHash: pin ? hashSecret(pin) : null } });
    result.created.push({ loginId, displayName, pin: pin || null });
  }
  return result;
}
