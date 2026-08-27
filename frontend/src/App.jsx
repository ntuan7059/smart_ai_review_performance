import React, { useEffect, useState } from "react";
import { ToastProvider } from "./context/ToastContext.jsx";
import { ConfigStatusProvider, useConfigStatus } from "./context/ConfigStatusContext.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import PRExplorerPage from "./pages/PRExplorerPage.jsx";
import SyncPage from "./pages/SyncPage.jsx";
import ByTicketPage from "./pages/ByTicketPage.jsx";
import PerformanceReviewPage from "./pages/PerformanceReviewPage.jsx";
import PrWatchPage from "./pages/PrWatchPage.jsx";

const TABS = [
  { key: "settings", label: "Settings", Component: SettingsPage, requires: null },
  { key: "explore", label: "Explore PRs", Component: PRExplorerPage, requires: "integrations" },
  { key: "sync", label: "Sync & Records", Component: SyncPage, requires: "integrations" },
  { key: "byTicket", label: "By Ticket", Component: ByTicketPage, requires: "integrations" },
  { key: "aiReview", label: "AI Review", Component: PerformanceReviewPage, requires: "integrations" },
  { key: "prWatch", label: "PR Watch", Component: PrWatchPage, requires: "integrations" },
];

const LOCK_TOOLTIP = "Connect Jira and Bitbucket successfully in Settings first";
const LOCK_MESSAGE = "This page needs a successful Jira + Bitbucket connection.";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="page">
          <div className="banner banner-error">
            Something went wrong rendering this page: {this.state.error.message}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function isLocked(t, configStatus) {
  if (t.requires === "integrations") {
    return !configStatus.loaded || !configStatus.jiraConnected || !configStatus.bitbucketConnected;
  }
  return false;
}

function Shell() {
  const [tab, setTab] = useState("settings");
  const configStatus = useConfigStatus();

  // If the active tab's requirement stops being met (e.g. a connection starts
  // failing after the user edits Settings), bounce back to Settings instead of
  // leaving a locked page on screen.
  useEffect(() => {
    const active = TABS.find((t) => t.key === tab);
    if (active && isLocked(active, configStatus)) setTab("settings");
  }, [tab, configStatus]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>AI Review Performance</h1>
        <nav className="tab-nav">
          {TABS.map((t) => {
            const locked = isLocked(t, configStatus);
            return (
              <button
                key={t.key}
                className={t.key === tab ? "tab active" : "tab"}
                onClick={() => setTab(t.key)}
                disabled={locked}
                title={locked ? LOCK_TOOLTIP : undefined}
                type="button"
              >
                {t.label}
                {locked ? " 🔒" : ""}
              </button>
            );
          })}
        </nav>
      </header>
      <main>
        {/* All unlocked tabs stay mounted (just hidden) so switching tabs never discards a
            page's state — e.g. an in-progress AI Review result or the PR Watch list/poll
            timer. Locked tabs aren't mounted at all, so they can't fire API calls before
            Jira and Bitbucket are both verified reachable. */}
        {TABS.map((t) => {
          const locked = isLocked(t, configStatus);
          return (
            <div key={t.key} style={{ display: t.key === tab ? "block" : "none" }}>
              <ErrorBoundary>
                {locked ? (
                  <div className="page">
                    <div className="banner banner-info">
                      {LOCK_MESSAGE}{" "}
                      <button type="button" className="link-button" onClick={() => setTab("settings")}>
                        Go to Settings
                      </button>
                    </div>
                  </div>
                ) : (
                  <t.Component />
                )}
              </ErrorBoundary>
            </div>
          );
        })}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ConfigStatusProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </ConfigStatusProvider>
  );
}
