"use client";

import Form from "next/form";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ProjectSort } from "@/lib/gallery";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

/** ギャラリーの検索。ふだんは小さなボタンだけを出し、押したとき・検索中だけ入力欄を広げる。 */
export function GallerySearch({
  slug,
  q,
  sessionId,
  sort,
}: {
  slug: string;
  q: string;
  sessionId: number | null;
  sort: ProjectSort;
}) {
  const searching = q !== "";
  const [open, setOpen] = useState(searching);
  const [focusInput, setFocusInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && focusInput) inputRef.current?.focus();
  }, [open, focusInput]);

  const close = (refocus: boolean) => {
    if (searching) return;
    setOpen(false);
    setFocusInput(false);
    if (refocus) requestAnimationFrame(() => toggleRef.current?.focus());
  };

  if (!open) {
    return (
      <button
        ref={toggleRef}
        type="button"
        className={`${ui.chip} inline-flex cursor-pointer items-center gap-1`}
        aria-expanded="false"
        onClick={() => {
          setOpen(true);
          setFocusInput(true);
        }}
      >
        <Search size={14} aria-hidden="true" />
        <span>{S.workshop.search}</span>
      </button>
    );
  }

  const params = new URLSearchParams();
  if (sessionId !== null) params.set("session", String(sessionId));
  if (sort !== "recent") params.set("sort", sort);
  const clearHref = `/${slug}${params.size > 0 ? `?${params.toString()}` : ""}`;

  return (
    <Form
      action={`/${slug}`}
      className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:min-w-0 sm:flex-1"
      role="search"
      onKeyDown={(e) => {
        if (e.key === "Escape") close(true);
      }}
      onBlur={(e) => {
        // 何も入力しないままフォームの外へフォーカスが移ったら閉じる
        if (!e.currentTarget.contains(e.relatedTarget as Node | null) && !inputRef.current?.value) close(false);
      }}
    >
      <label className="relative w-full sm:w-auto sm:max-w-md sm:min-w-0 sm:flex-1">
        <span className="sr-only">{S.workshop.search}</span>
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          name="q"
          defaultValue={q}
          maxLength={100}
          placeholder={S.workshop.searchPlaceholder}
          className="min-h-10 w-full rounded-full border border-line bg-surface py-2 pr-4 pl-9 text-base text-ink"
        />
      </label>
      {/* 検索をやめたときに元のセッションへ戻れるよう、セッションも引き継ぐ */}
      {sessionId !== null ? <input type="hidden" name="session" value={sessionId} /> : null}
      {sort !== "recent" ? <input type="hidden" name="sort" value={sort} /> : null}
      <button type="submit" className={ui.secondary}>
        {S.workshop.search}
      </button>
      {searching ? (
        <Link className={ui.secondary} href={clearHref}>
          <X size={16} />
          <span>{S.workshop.searchClear}</span>
        </Link>
      ) : null}
    </Form>
  );
}
