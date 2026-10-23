// サイト管理画面の client component 用 fetch ヘルパー（basePath を付ける）。
export const ADMIN_API = "/3dp/api/admin";

export async function adminCall<T = Record<string, unknown>>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<{ ok: boolean; error?: string; data: T }> {
  const res = await fetch(`${ADMIN_API}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, error: res.ok ? undefined : j.error || "失敗しました", data: j };
}
