"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Link as LinkIcon } from "lucide-react";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

/** navigator.clipboard は https か localhost でしか使えないので、使えないときは execCommand で試す。 */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}

export function CopyUrlButton({ url }: { url: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    const ok = await copyText(url);
    setState(ok ? "copied" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  };

  return (
    <div className="grid justify-items-start gap-1.5">
      <button type="button" className={ui.secondary} onClick={copy}>
        {state === "copied" ? <Check size={16} /> : <LinkIcon size={16} />}
        <span>{state === "copied" ? S.project.urlCopied : S.project.copyUrl}</span>
      </button>
      {/* 読み上げ用に結果を通知する。失敗時は下の URL を手で選んでコピーできる */}
      <span role="status" className={state === "failed" ? ui.error : "sr-only"}>
        {state === "failed" ? S.project.urlCopyFailed : state === "copied" ? S.project.urlCopied : ""}
      </span>
    </div>
  );
}
