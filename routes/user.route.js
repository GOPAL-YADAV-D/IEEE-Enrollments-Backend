import express from "express";
import {
  authenticateFirebaseUser,
  protectUserRoute,
} from "../middleware/auth.middleware.js";
import {
  fetchAvailableSlots,
  fetchUserData,
  login,
  logout,
  ready,
  refreshToken,
  round0Submission,
  selectSlot,
  taskSubmission,
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/", protectUserRoute, fetchUserData);
router.post("/", authenticateFirebaseUser, login);
router.post("/logout", logout);
router.post("/refresh-token", refreshToken);
router.post("/r0-submission", protectUserRoute, round0Submission);
router.get("/available-slots", protectUserRoute, fetchAvailableSlots);
router.put("/select-slot/:slotId", protectUserRoute, selectSlot);
router.put("/ready/:slotId", protectUserRoute, ready);
router.post("/task-submission", protectUserRoute, taskSubmission);

export default router;
