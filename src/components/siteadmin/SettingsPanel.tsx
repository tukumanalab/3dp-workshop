"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SITE_SETTING_LIMITS } from "@/lib/siteSettingsLimits";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";
import { adminCall } from "./api";

type Values = { siteName: string; siteDescription: string; footerText: string; operatorName: string; operatorContact: string };

export function SettingsPanel({ initial }: { initial: Values }) {
  const router = useRouter();
  const t = S.siteAdmin.settings;
  const [v, setV] = useState<Values>({
    siteName: initial.siteName,
    siteDescription: initial.siteDescription,
    footerText: initial.footerText,
    operatorName: initial.operatorName,
    operatorContact: initial.operatorContact,
  });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((p) => ({ ...p, [k]: e.target.value }));
  return (
    <form
      className={`${ui.card} ${ui.stack} max-w-2xl`}
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg("");
        setError("");
        const r = await adminCall("/site-settings", "PATCH", v);
        if (r.ok) {
          setMsg(t.saved);
          router.refresh();
        } else setError(r.error || S.common.failed);
      }}
    >
      <p className={ui.muted}>{t.hint}</p>
      <label className={ui.field}>
        {t.siteName}
        <input value={v.siteName} onChange={set("siteName")} maxLength={SITE_SETTING_LIMITS.siteName} />
      </label>
      <label className={ui.field}>
        {t.siteDescription}
        <textarea value={v.siteDescription} onChange={set("siteDescription")} rows={2} maxLength={SITE_SETTING_LIMITS.siteDescription} />
      </label>
      <label className={ui.field}>
        {t.footerText}
        <textarea value={v.footerText} onChange={set("footerText")} rows={2} maxLength={SITE_SETTING_LIMITS.footerText} />
      </label>
      <label className={ui.field}>
        {t.operatorName}
        <input value={v.operatorName} onChange={set("operatorName")} maxLength={SITE_SETTING_LIMITS.operatorName} />
      </label>
      <label className={ui.field}>
        {t.operatorContact}
        <input value={v.operatorContact} onChange={set("operatorContact")} maxLength={SITE_SETTING_LIMITS.operatorContact} />
      </label>
      <div className={ui.row}>
        <button className={ui.primary} type="submit">
          {t.save}
        </button>
        {msg ? <span className={ui.ok}>{msg}</span> : null}
        {error ? <span className={ui.error}>{error}</span> : null}
      </div>
    </form>
  );
}
