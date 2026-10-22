"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiButton } from "../ApiButton";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";
import { workshopApi, wsCall } from "./api";
import { MaterialsEditor, type AdminMaterial } from "./MaterialsEditor";

export function SettingsTab(props: {
  slug: string;
  origin: string;
  isOwner: boolean;
  workshop: { title: string; description: string; visibility: string; joinCode: string; isOpen: boolean };
  materials: AdminMaterial[];
  maxMaterialBytes: number;
}) {
  const router = useRouter();
  const api = workshopApi(props.slug);
  const [title, setTitle] = useState(props.workshop.title);
  const [description, setDescription] = useState(props.workshop.description);
  const [visibility, setVisibility] = useState(props.workshop.visibility);
  const [isOpen, setIsOpen] = useState(props.workshop.isOpen);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const joinUrl = `${props.origin}/3dp-workshop/${props.slug}/join?code=${props.workshop.joinCode}`;

  return (
    <div className={ui.stack}>
      <section className={`${ui.card} ${ui.stack}`}>
        <h2>{S.admin.joinCode}</h2>
        <div className={ui.row}>
          <span className={ui.code}>{props.workshop.joinCode}</span>
          <ApiButton url={api} method="PATCH" body={{ regenerateJoinCode: true }}>
            {S.admin.regenerate}
          </ApiButton>
          <Link className={ui.secondary} href={`/${props.slug}/admin/print?kind=join`}>
            <Printer size={16} />
            <span>{S.admin.printJoin}</span>
          </Link>
        </div>
        <p className={ui.muted}>
          {S.admin.joinUrl}: <code className="break-all">{joinUrl}</code>
        </p>
      </section>

      <form
        className={`${ui.card} ${ui.stack}`}
        onSubmit={async (e) => {
          e.preventDefault();
          setMsg("");
          setError("");
          const r = await wsCall(api, "PATCH", { title, description, visibility, isOpen });
          if (r.ok) {
            setMsg(S.project.saved);
            router.refresh();
          } else setError(r.error || S.common.failed);
        }}
      >
        <h2>{S.admin.settings}</h2>
        <label className={ui.field}>
          {S.dashboard.titleLabel}
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={100} />
        </label>
        <label className={ui.field}>
          {S.dashboard.descriptionLabel}
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <label className={ui.field}>
          {S.dashboard.visibilityLabel}
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="PUBLIC">{S.visibility.PUBLIC}</option>
            <option value="UNLISTED">{S.visibility.UNLISTED}</option>
            <option value="PRIVATE">{S.visibility.PRIVATE}</option>
          </select>
        </label>
        <label className={ui.row}>
          <input type="checkbox" checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)} />
          <span>{S.admin.open}</span>
        </label>
        <div className={ui.row}>
          <button className={ui.primary} type="submit">
            {S.admin.saveSettings}
          </button>
          {msg ? <span className={ui.ok}>{msg}</span> : null}
          {error ? <span className={ui.error}>{error}</span> : null}
        </div>
      </form>

      <section className={ui.card}>
        <MaterialsEditor slug={props.slug} sessionId={null} maxBytes={props.maxMaterialBytes} materials={props.materials} />
      </section>

      {props.isOwner ? (
        <section className={ui.card}>
          <ApiButton url={api} method="DELETE" confirm={S.admin.deleteWorkshopConfirm} redirectTo="/dashboard">
            <span className={ui.danger}>{S.admin.deleteWorkshop}</span>
          </ApiButton>
        </section>
      ) : null}
    </div>
  );
}
