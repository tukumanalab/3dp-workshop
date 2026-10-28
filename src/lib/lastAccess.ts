// クライアントからも使うので、prisma を import しない

/** 最終アクセスの更新を間引く間隔。これより新しければ書き込まない。 */
export const LAST_ACCESS_THROTTLE_MS = 10 * 60_000;

/** 絞り込みに使う最終活動日時。記録が無い（事前登録のまま未ログインなど）ときは登録日時で代用する。 */
export function lastActiveAt(p: { lastAccessAt: Date | string | null; createdAt: Date | string }): Date {
  return new Date(p.lastAccessAt ?? p.createdAt);
}
