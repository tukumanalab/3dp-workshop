import { canAdministerSite, type Viewer } from "./access";
import { notFound, unauthorized } from "./http";
import { viewerFromRequest } from "./viewer";
import { prisma } from "./db";

/** 有効（APPROVED）な admin の人数。excludeUserId を除いて数えられる。 */
export function countActiveAdmins(excludeUserId?: number): Promise<number> {
  return prisma.user.count({
    where: {
      role: "admin",
      status: "APPROVED",
      ...(excludeUserId !== undefined ? { id: { not: excludeUserId } } : {}),
    },
  });
}

/**
 * 対象ユーザーが「有効な admin」で、その人を admin から外す／停止する／削除すると
 * 有効な admin が 0 人になる場合に true を返す（呼び出し側が 409 にする）。
 */
export async function wouldRemoveLastAdmin(target: { id: number; role: string; status: string }): Promise<boolean> {
  if (target.role !== "admin" || target.status !== "APPROVED") return false;
  return (await countActiveAdmins(target.id)) === 0;
}

/** 管理 API 共通のガード。未ログインは 401、admin 以外は 404（存在を隠す）。 */
export async function requireSiteAdmin(req: Request): Promise<{ viewer: Viewer } | { response: Response }> {
  const viewer = await viewerFromRequest(req);
  if (!viewer.user) return { response: unauthorized() };
  if (!canAdministerSite(viewer)) return { response: notFound() };
  return { viewer };
}
