import React, { useState } from "react";
import { ToastProvider } from "./context/ToastContext.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import PRExplorerPage from "./pages/PRExplorerPage.jsx";
import SyncPage from "./pages/SyncPage.jsx";
import ByTicketPage from "./pages/ByTicketPage.jsx";
import PerformanceReviewPage from "./pages/PerformanceReviewPage.jsx";

const TABS = [
  { key: "settings", label: "Settings", Component: SettingsPage },
  { key: "explore", label: "Explore PRs", Component: PRExplorerPage },
  { key: "sync", label: "Sync & Records", Component: SyncPage },
  { key: "byTicket", label: "By Ticket", Component: ByTicketPage },
  { key: "aiReview", label: "AI Review", Component: PerformanceReviewPage },
];

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

export default function App() {
  const [tab, setTab] = useState("settings");
  const Active = TABS.find((t) => t.key === tab)?.Component ?? SettingsPage;

  return (
    <ToastProvider>
      <div className="app-shell">
        <header className="app-header">
          <h1>AI Review Performance</h1>
          <nav className="tab-nav">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={t.key === tab ? "tab active" : "tab"}
                onClick={() => setTab(t.key)}
                type="button"
              >
                {t.label}
              </button>
            ))}
          </nav>
        </header>
        <main>
          <ErrorBoundary key={tab}>
            <Active />
          </ErrorBoundary>
        </main>
      </div>
    </ToastProvider>
  );
}
