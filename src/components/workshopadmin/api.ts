// ワークショップ管理画面の client component 用 fetch ヘルパー（basePath を付ける）。
export const workshopApi = (slug: string) => `/3dp-workshop/api/workshops/${slug}`;

export async function wsCall<T = Record<string, unknown>>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<{ ok: boolean; error?: string; data: T }> {
  const isForm = body instanceof FormData;
  const res = await fetch(url, {
    method,
    headers: body === undefined || isForm ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, error: res.ok ? undefined : j.error || "失敗しました", data: j };
}
