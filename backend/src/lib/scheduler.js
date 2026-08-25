import { pollNewPrs } from "../services/prWatchService.js";
import { log, logError } from "./logger.js";

const POLL_INTERVAL_MS = 30 * 60 * 1000;

export function startPrWatchScheduler() {
  async function tick() {
    try {
      await pollNewPrs();
    } catch (err) {
      logError("PR watch poll failed:", err.message);
    }
  }

  tick();
  setInterval(tick, POLL_INTERVAL_MS);
  log(`PR watch scheduler started (polling every ${POLL_INTERVAL_MS / 60000} min).`);
}
