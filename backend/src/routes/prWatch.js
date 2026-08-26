import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { listWatchItems, pollNewPrs, reviewWatchedPr } from "../services/prWatchService.js";
import { appendEvent } from "../store/usageEventStore.js";
import { resolveEmail } from "../store/authorEmailStore.js";

const router = Router();

router.get(
  "/pr-watch",
  asyncHandler(async (req, res) => {
    res.json(listWatchItems());
  })
);

router.post(
  "/pr-watch/refresh",
  asyncHandler(async (req, res) => {
    const added = await pollNewPrs();
    res.json({ added: added.length, items: listWatchItems() });
  })
);

router.post(
  "/pr-watch/:repo/:id/review",
  asyncHandler(async (req, res) => {
    const item = await reviewWatchedPr({ repo: req.params.repo, prId: req.params.id });
    if (!item) return res.status(404).json({ error: { message: "PR not found in today's watch list." } });
    appendEvent({
      type: "pr_review",
      repo: req.params.repo,
      prId: req.params.id,
      author: item.author,
      authorUsername: item.authorUsername,
      authorEmail: resolveEmail(item.author, item.authorUsername),
    });
    res.json(item);
  })
);

export default router;
