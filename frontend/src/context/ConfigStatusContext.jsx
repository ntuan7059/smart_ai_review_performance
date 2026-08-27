import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api.js";

const ConfigStatusContext = createContext(null);

export function ConfigStatusProvider({ children }) {
  const [loaded, setLoaded] = useState(false);
  const [jiraConnected, setJiraConnected] = useState(false);
  const [bitbucketConnected, setBitbucketConnected] = useState(false);

  const refresh = useCallback(async () => {
    const cfg = await api.getConfig();
    const jiraFilled = Boolean(cfg.jiraBaseUrl && cfg.atlassianEmail && cfg.atlassianApiTokenSet);
    const bitbucketFilled = Boolean(cfg.atlassianEmail && cfg.bitbucketApiTokenSet);

    let jiraOk = false;
    let bitbucketOk = false;
    if (jiraFilled || bitbucketFilled) {
      // Fields being filled in isn't enough — actually ping both APIs so the tabs
      // only unlock once Jira and Bitbucket are reachable with these credentials.
      try {
        const result = await api.testConnections();
        jiraOk = jiraFilled && Boolean(result.jira?.ok);
        bitbucketOk = bitbucketFilled && Boolean(result.bitbucket?.ok);
      } catch {
        // leave both false — tabs stay locked if the test call itself fails
      }
    }

    setJiraConnected(jiraOk);
    setBitbucketConnected(bitbucketOk);
    setLoaded(true);
    return cfg;
  }, []);

  useEffect(() => {
    refresh().catch(() => setLoaded(true));
  }, [refresh]);

  const value = {
    loaded,
    jiraConnected,
    bitbucketConnected,
    refresh,
  };

  return <ConfigStatusContext.Provider value={value}>{children}</ConfigStatusContext.Provider>;
}

export function useConfigStatus() {
  const ctx = useContext(ConfigStatusContext);
  if (!ctx) throw new Error("useConfigStatus must be used within ConfigStatusProvider");
  return ctx;
}
