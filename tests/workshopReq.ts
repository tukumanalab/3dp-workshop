// ワークショップ API テスト用の Request / params ヘルパー。
export const wsUrl = (slug: string, p = "") => `http://localhost/3dp/api/workshops/${slug}${p}`;

export const jsonReq = (u: string, method = "GET", cookie?: string, body?: unknown) =>
  new Request(u, {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) });
