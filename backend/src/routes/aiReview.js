import { Router } from "express";
import { reviewUser, listAuthors } from "../services/performanceReviewService.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { appendEvent } from "../store/usageEventStore.js";
import { resolveEmail } from "../store/authorEmailStore.js";

const router = Router();

router.get(
  "/ai-review/authors",
  asyncHandler(async (req, res) => {
    res.json(await listAuthors());
  })
);

router.post(
  "/ai-review",
  asyncHandler(async (req, res) => {
    const { author, from, to } = req.body || {};
    if (!author) return res.status(400).json({ error: { message: "author is required" } });
    const result = await reviewUser({ author, from, to });
    appendEvent({
      type: "performance_review",
      author,
      authorEmail: resolveEmail(author, author),
      meta: { from: from || null, to: to || null },
    });
    res.json(result);
  })
);

export default router;
