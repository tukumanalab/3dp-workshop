"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const CHANNEL = "3dp-workshop:projects";
const INTERVAL_MS = 10_000;

/** 同じブラウザの別タブへ、作品が変わったことを知らせる（BroadcastChannel が無ければ何もしない） */
export function notifyProjectsChanged(slug: string) {
  if (typeof BroadcastChannel === "undefined") return;
  const ch = new BroadcastChannel(CHANNEL);
  ch.postMessage({ slug });
  ch.close();
}

/**
 * 作品の変化を見張って一覧を描き直す。表示されている間だけ 10 秒ごとに digest を確認し、
 * 同じブラウザの別タブからの知らせはすぐに反映する。
 */
export function LiveRefresh({ slug }: { slug: string }) {
  const router = useRouter();

  useEffect(() => {
    let last: string | null = null;
    let stopped = false;

    async function check() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/3dp/api/workshops/${slug}/projects/digest`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const { digest } = (await res.json()) as { digest: string };
        if (last !== null && digest !== last) router.refresh();
        last = digest;
      } catch {
        // 通信エラーは次の回で確認し直す
      }
    }

    void check();
    const timer = setInterval(check, INTERVAL_MS);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    const ch = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL);
    if (ch) {
      ch.onmessage = (e: MessageEvent<{ slug?: string }>) => {
        if (e.data?.slug === slug) router.refresh();
      };
    }
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      ch?.close();
    };
  }, [slug, router]);

  return null;
}
