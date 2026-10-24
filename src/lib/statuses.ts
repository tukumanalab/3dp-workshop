// 作品の状態（ラベル = 状態の種類、オプション = 状態名）。1 ラベルにつき作品はオプションを 1 つだけ持つ。
import { prisma } from "./db";
import { MAX_STATUS_NAME } from "./statusLimits";

export { MAX_STATUS_LABELS, MAX_STATUS_NAME, MAX_STATUS_OPTIONS } from "./statusLimits";

export type StatusOptionView = { id: number; name: string };
export type StatusLabelView = { id: number; name: string; options: StatusOptionView[] };
/** 作品に付いた状態（ラベル順に並ぶ） */
export type ProjectStatusView = { labelId: number; labelName: string; optionId: number; optionName: string };
export type StatusSelection = { labelId: number; optionId: number };

export async function listStatusLabels(workshopId: number): Promise<StatusLabelView[]> {
  const labels = await prisma.statusLabel.findMany({
    where: { workshopId },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    include: { options: { orderBy: [{ order: "asc" }, { id: "asc" }] } },
  });
  return labels.map((l) => ({ id: l.id, name: l.name, options: l.options.map((o) => ({ id: o.id, name: o.name })) }));
}

/** ラベル名・状態名の検証。前後の空白を除き 1〜MAX_STATUS_NAME 文字。不正なら null。 */
export function normalizeStatusName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const n = v.trim();
  return n && n.length <= MAX_STATUS_NAME ? n : null;
}

/** ラベル順・オプション順に並べた作品の状態。定義から消えたものは捨てる。 */
export function resolveProjectStatuses(labels: StatusLabelView[], rows: { optionId: number }[]): ProjectStatusView[] {
  const chosen = new Set(rows.map((r) => r.optionId));
  const out: ProjectStatusView[] = [];
  for (const l of labels) {
    const o = l.options.find((x) => chosen.has(x.id));
    if (o) out.push({ labelId: l.id, labelName: l.name, optionId: o.id, optionName: o.name });
  }
  return out;
}

/** optionId の配列を検証し、ラベルごとの選択に直す。他のワークショップのオプションや、同じラベルの 2 つ指定はエラー。 */
export function resolveStatusSelection(
  labels: StatusLabelView[],
  optionIds: unknown,
): { ok: true; selection: StatusSelection[] } | { ok: false; error: string } {
  if (!Array.isArray(optionIds)) return { ok: false, error: "状態の指定が不正です" };
  const labelOf = new Map(labels.flatMap((l) => l.options.map((o) => [o.id, l.id] as const)));
  const selection: StatusSelection[] = [];
  for (const id of optionIds) {
    const labelId = typeof id === "number" ? labelOf.get(id) : undefined;
    if (labelId === undefined) return { ok: false, error: "状態が見つかりません" };
    if (selection.some((s) => s.labelId === labelId)) return { ok: false, error: "1 つの種類に選べる状態は 1 つだけです" };
    selection.push({ labelId, optionId: id as number });
  }
  return { ok: true, selection };
}

/** 作品の状態を selection で置き換える */
export async function setProjectStatuses(projectId: number, selection: StatusSelection[]) {
  await prisma.$transaction([
    prisma.projectStatus.deleteMany({ where: { projectId } }),
    ...selection.map((s) => prisma.projectStatus.create({ data: { projectId, labelId: s.labelId, optionId: s.optionId } })),
  ]);
}

// ---- ギャラリーの絞り込み ----
// URL の `status` パラメータ: カンマ区切りで `<optionId>` か `none:<labelId>`（そのラベルが未設定）。
// 同じラベルの中は OR、ラベル同士は AND。

export type StatusFilterToken = string;

export function parseStatusFilter(v: string | undefined): StatusFilterToken[] {
  const out: StatusFilterToken[] = [];
  for (const t of (v ?? "").split(",")) {
    if ((/^\d{1,9}$/.test(t) || /^none:\d{1,9}$/.test(t)) && !out.includes(t)) out.push(t);
    if (out.length >= 50) break;
  }
  return out;
}

export const noneToken = (labelId: number): StatusFilterToken => `none:${labelId}`;

/** トークンを付け外しした新しい配列（定義済みの順に並べ直す） */
export function toggleStatusFilter(labels: StatusLabelView[], tokens: StatusFilterToken[], token: StatusFilterToken): StatusFilterToken[] {
  const next = tokens.includes(token) ? tokens.filter((t) => t !== token) : [...tokens, token];
  const order = labels.flatMap((l) => [...l.options.map((o) => String(o.id)), noneToken(l.id)]);
  return order.filter((t) => next.includes(t));
}

/** 定義に存在するトークンだけを、ラベルごとにまとめる */
function groupFilter(labels: StatusLabelView[], tokens: StatusFilterToken[]) {
  const groups: { labelId: number; optionIds: Set<number>; none: boolean }[] = [];
  for (const l of labels) {
    const optionIds = new Set(l.options.filter((o) => tokens.includes(String(o.id))).map((o) => o.id));
    const none = tokens.includes(noneToken(l.id));
    if (optionIds.size > 0 || none) groups.push({ labelId: l.id, optionIds, none });
  }
  return groups;
}

/** 定義から消えたものを除いた、有効なトークン */
export const activeStatusFilter = (labels: StatusLabelView[], tokens: StatusFilterToken[]): StatusFilterToken[] =>
  groupFilter(labels, tokens).flatMap((g) => [...[...g.optionIds].map(String), ...(g.none ? [noneToken(g.labelId)] : [])]);

export function filterProjectsByStatus<T extends { statuses: { labelId: number; optionId: number }[] }>(
  cards: T[],
  labels: StatusLabelView[],
  tokens: StatusFilterToken[],
): T[] {
  const groups = groupFilter(labels, tokens);
  if (groups.length === 0) return cards;
  return cards.filter((c) =>
    groups.every((g) => {
      const s = c.statuses.find((x) => x.labelId === g.labelId);
      return s ? g.optionIds.has(s.optionId) : g.none;
    }),
  );
}
