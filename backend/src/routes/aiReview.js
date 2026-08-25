import { Router } from "express";
import { reviewUser, listAuthors } from "../services/performanceReviewService.js";
import { asyncHandler } from "../lib/asyncHandler.js";

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
    res.json(await reviewUser({ author, from, to }));
  })
);

export default router;
