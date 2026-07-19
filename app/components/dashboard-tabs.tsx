"use client";

import { useId, useState, type ReactNode } from "react";

export type DashboardTabItem = {
  id: string;
  label: string;
  summary: string;
  children: ReactNode;
};

export function DashboardTabs({ tabs }: { tabs: DashboardTabItem[] }) {
  const generatedId = useId();
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? "");
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  if (!activeTab) {
    return null;
  }

  return (
    <section className="dashboard-tabs" aria-label="대시보드 데이터">
      <div className="dashboard-tab-list" role="tablist" aria-label="대시보드 내부 탭">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab.id;
          const tabId = `${generatedId}-${tab.id}-tab`;
          const panelId = `${generatedId}-${tab.id}-panel`;

          return (
            <button
              aria-controls={panelId}
              aria-selected={isActive}
              className="dashboard-tab-button"
              id={tabId}
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              role="tab"
              type="button"
            >
              <span>{tab.label}</span>
              <small>{tab.summary}</small>
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab.id;

        return (
          <div
            aria-labelledby={`${generatedId}-${tab.id}-tab`}
            className="dashboard-tab-panel"
            hidden={!isActive}
            id={`${generatedId}-${tab.id}-panel`}
            key={tab.id}
            role="tabpanel"
          >
            {tab.children}
          </div>
        );
      })}
    </section>
  );
}
