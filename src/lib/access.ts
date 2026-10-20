// アクセス判定の単一情報源（純関数）。route / page からはここだけを呼ぶ。
// 判定表は xcratch-workshop docs/spec.md §5.2 を移植:
//   canView = (作者本人 or staff) or (isShared and canViewSession(所属セッション))
//   canViewSession = ワークショップゲート and セッションゲート
// 見えない作品は 404 を返す（存在を秘匿する）ため、呼び出し側は canView が false なら 404 にする。

export const WORKSHOP_VISIBILITIES = ["PUBLIC", "UNLISTED", "PRIVATE"] as const;
export type WorkshopVisibility = (typeof WORKSHOP_VISIBILITIES)[number];
export const isWorkshopVisibility = (v: unknown): v is WorkshopVisibility =>
  typeof v === "string" && (WORKSHOP_VISIBILITIES as readonly string[]).includes(v);

export const SESSION_VISIBILITIES = ["PUBLIC", "PRIVATE"] as const;
export type SessionVisibility = (typeof SESSION_VISIBILITIES)[number];
export const isSessionVisibility = (v: unknown): v is SessionVisibility =>
  typeof v === "string" && (SESSION_VISIBILITIES as readonly string[]).includes(v);

export interface WorkshopForAccess {
  id: number;
  ownerId: number;
  visibility: string;
  isOpen?: boolean;
  endsAt?: Date | null;
  staff?: { userId: number }[];
}

export interface SessionForAccess {
  workshopId: number;
  visibility: string;
}

export interface ProjectForAccess {
  workshopId: number;
  participantId: number | null;
  userId: number | null;
  isShared: boolean;
}

export interface Viewer {
  user?: { userId: number; role: string } | undefined;
  /** 参加登録済みのワークショップごとのセッション (ワークショップ id -> participantId) */
  participants?: { participantId: number; workshopId: number }[];
}

export const isSiteAdmin = (v: Viewer): boolean => v.user?.role === "admin";

export const isWorkshopOwner = (w: WorkshopForAccess, v: Viewer): boolean =>
  !!v.user && w.ownerId === v.user.userId;

/** owner か共同運営者。admin は含めない（到達特権のみ）。 */
export const isWorkshopStaff = (w: WorkshopForAccess, v: Viewer): boolean => {
  if (!v.user) return false;
  if (w.ownerId === v.user.userId) return true;
  return (w.staff ?? []).some((s) => s.userId === v.user!.userId);
};

export const hasReachPrivilege = (w: WorkshopForAccess, v: Viewer): boolean =>
  isWorkshopStaff(w, v) || isSiteAdmin(v);

export const participantIdFor = (w: { id: number }, v: Viewer): number | null =>
  v.participants?.find((p) => p.workshopId === w.id)?.participantId ?? null;

export const isWorkshopParticipant = (w: { id: number }, v: Viewer): boolean =>
  participantIdFor(w, v) !== null;

export const canViewWorkshop = (w: WorkshopForAccess, v: Viewer): boolean => {
  if (hasReachPrivilege(w, v)) return true;
  if (isWorkshopParticipant(w, v)) return true;
  return w.visibility === "PUBLIC" || w.visibility === "UNLISTED";
};

export const canViewSession = (w: WorkshopForAccess, s: SessionForAccess, v: Viewer): boolean => {
  if (s.workshopId !== w.id) return false;
  if (!canViewWorkshop(w, v)) return false;
  if (hasReachPrivilege(w, v) || isWorkshopParticipant(w, v)) return true;
  return s.visibility === "PUBLIC";
};

export const isAuthor = (w: { id: number }, p: ProjectForAccess, v: Viewer): boolean => {
  if (p.workshopId !== w.id) return false;
  if (p.participantId !== null && participantIdFor(w, v) === p.participantId) return true;
  if (p.userId !== null && v.user?.userId === p.userId) return true;
  return false;
};

export const canViewProject = (
  w: WorkshopForAccess,
  s: SessionForAccess,
  p: ProjectForAccess,
  v: Viewer,
): boolean => {
  if (p.workshopId !== w.id) return false;
  if (isAuthor(w, p, v) || isWorkshopStaff(w, v)) return true;
  return p.isShared && canViewSession(w, s, v);
};

/** 受付中か（isOpen かつ終了日時前）。閉じている間は新規作成・保存不可。 */
export const isWorkshopWritable = (w: WorkshopForAccess, now: Date = new Date()): boolean => {
  if (w.isOpen === false) return false;
  if (w.endsAt && w.endsAt.getTime() <= now.getTime()) return false;
  return true;
};

/** 作品の中身・メタを編集できるのは作者本人のみ（staff でも他人の作品は不可）。 */
export const canEditProject = (w: WorkshopForAccess, p: ProjectForAccess, v: Viewer): boolean =>
  isAuthor(w, p, v) && isWorkshopWritable(w);

/** 削除・共有切替は作者本人または staff。 */
export const canManageProject = (w: WorkshopForAccess, p: ProjectForAccess, v: Viewer): boolean =>
  isAuthor(w, p, v) || isWorkshopStaff(w, v);

/** 作品を新規作成（保存・リミックス）できるのは参加者か staff。 */
export const canCreateProject = (w: WorkshopForAccess, v: Viewer): boolean =>
  isWorkshopWritable(w) && (isWorkshopParticipant(w, v) || isWorkshopStaff(w, v));

/** 参加コードを見られる人 */
export const canSeeJoinCode = (w: WorkshopForAccess, v: Viewer): boolean => isWorkshopStaff(w, v);
