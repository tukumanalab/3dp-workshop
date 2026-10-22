"use client";

import { Printer } from "lucide-react";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

export function PrintButton() {
  return (
    <button type="button" className={ui.primary} onClick={() => window.print()}>
      <Printer size={16} />
      <span>{S.admin.print.print}</span>
    </button>
  );
}
