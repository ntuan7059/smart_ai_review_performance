import { Router } from "express";
import { getTicket } from "../services/jiraService.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

router.get(
  "/jira/tickets/:key",
  asyncHandler(async (req, res) => {
    const ticket = await getTicket(req.params.key);
    if (ticket.error) {
      const status = ticket.error.type === "NOT_FOUND" ? 404 : 403;
      return res.status(status).json({ error: ticket.error });
    }
    res.json(ticket);
  })
);

export default router;
