"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useState } from "react";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

export function CreateWorkshopForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <div>
        <button
          className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-accent bg-accent-soft px-5 py-5 text-base font-bold text-ink transition-colors hover:bg-sunken sm:w-auto"
          type="button"
          onClick={() => setOpen(true)}
        >
          <span className="grid size-10 place-items-center rounded-full bg-accent text-on-accent">
            <Plus size={22} />
          </span>
          <span>{S.dashboard.create}</span>
        </button>
      </div>
    );
  }

  return (
    <form
      className={`${ui.card} ${ui.stack}`}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const res = await fetch("/layerling-workshop/api/workshops", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title, slug, description, visibility }),
        });
        setBusy(false);
        if (res.ok) {
          router.push(`/${slug.trim().toLowerCase()}/admin`);
          router.refresh();
        } else {
          setError(((await res.json().catch(() => ({}))) as { error?: string }).error || S.common.failed);
        }
      }}
    >
      <h2>{S.dashboard.create}</h2>
      <label className={ui.field}>
        {S.dashboard.titleLabel}
        <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={100} />
      </label>
      <label className={ui.field}>
        {S.dashboard.slugLabel}
        <input value={slug} onChange={(e) => setSlug(e.target.value)} required pattern="[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]" />
      </label>
      <label className={ui.field}>
        {S.dashboard.descriptionLabel}
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} />
      </label>
      <label className={ui.field}>
        {S.dashboard.visibilityLabel}
        <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          <option value="PUBLIC">{S.visibility.PUBLIC}</option>
          <option value="UNLISTED">{S.visibility.UNLISTED}</option>
          <option value="PRIVATE">{S.visibility.PRIVATE}</option>
        </select>
      </label>
      {error ? <p className={ui.error}>{error}</p> : null}
      <div className={ui.row}>
        <button className={ui.primary} type="submit" disabled={busy}>
          {busy ? S.dashboard.creating : S.dashboard.create}
        </button>
        <button className={ui.secondary} type="button" onClick={() => setOpen(false)}>
          {S.common.cancel}
        </button>
      </div>
    </form>
  );
}
