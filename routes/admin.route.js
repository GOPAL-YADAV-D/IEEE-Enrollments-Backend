import express from "express";
import {
  authenticateFirebaseUser,
  protectAdminRoute,
  protectSuperadminRoute,
} from "../middleware/auth.middleware.js";
import {
  createSlot,
  fetchAdminData,
  fetchAllSlots,
  joinSlot,
  login,
  logout,
  meetLinkSubmission,
  refreshToken,
  reviewSlots,
  reviewSubmission,
  round0Elimination,
  round1Elimination,
  round2Elimination,
  takeSlot,
} from "../controllers/admin.controller.js";

const router = express.Router();

router.get("/", protectAdminRoute, fetchAdminData);
router.post("/", authenticateFirebaseUser, login);
router.post("/logout", logout);
router.post("/refresh-token", refreshToken);
router.post("/meetlink-submission", protectAdminRoute, meetLinkSubmission);
router.post(
  "/create-slot",
  protectAdminRoute,
  protectSuperadminRoute,
  createSlot
);
router.post("/get-all-slots", protectAdminRoute, fetchAllSlots);
router.put("/take-slot/:slotId", protectAdminRoute, takeSlot);
router.put("/join-slot/:slotId", protectAdminRoute, joinSlot);
router.get("/review-slots", protectAdminRoute, reviewSlots);
router.post(
  "/review-submission/:slotId/:userId",
  protectAdminRoute,
  reviewSubmission
);
router.put(
  "/r0-elimination",
  protectAdminRoute,
  protectSuperadminRoute,
  round0Elimination
);
router.put(
  "/r1-elimination",
  protectAdminRoute,
  protectSuperadminRoute,
  round1Elimination
);
router.put(
  "/r2-elimination",
  protectAdminRoute,
  protectSuperadminRoute,
  round2Elimination
);

export default router;
