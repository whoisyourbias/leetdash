"use client";

import { type ReactNode, useState } from "react";
import { ChevronRight } from "lucide-react";

export function CatalogProblemList({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="panel catalog-panel">
      <button
        className="catalog-panel-toggle"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        type="button"
      >
        <ChevronRight className={`catalog-chevron ${open ? "open" : ""}`} size={20} aria-hidden="true" />
        <div className="panel-header-content">
          <h2>{title}</h2>
          <p className="panel-subtitle">{subtitle}</p>
        </div>
      </button>
      <div className={`catalog-panel-body ${open ? "open" : ""}`}>{children}</div>
    </section>
  );
}
