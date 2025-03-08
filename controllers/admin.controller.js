import jwt from "jsonwebtoken";
import moment from "moment-timezone";
import mongoose from "mongoose";
import { generateTokens, setCookies } from "../lib/auth.js";
import User from "../models/user.model.js";
import Admin from "../models/admin.model.js";
import Slot from "../models/slot.model.js";
import sendMail from "../lib/mail.js";

export const fetchAdminData = async (req, res) => {
  try {
    const admin = req.user;
    return res.status(200).json({
      success: true,
      data: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        meetLink: admin.meetLink,
        access: admin.access,
      },
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

export const login = async (req, res) => {
  const { name, email } = req.user;
  if (
    !email ||
    email.trim().length === 0 ||
    !name ||
    name.trim().length === 0
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Email and name are required" });
  }
  const regNoIndex = name.lastIndexOf(" ");
  const adminName = name.slice(0, regNoIndex).trim();
  try {
    const currentAdmin = await Admin.findOne({ email });
    let admin;
    if (currentAdmin) {
      admin = currentAdmin;
    } else {
      admin = await Admin.create({ name: adminName, email });
    }
    const { accessToken, refreshToken } = generateTokens(admin._id);
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + 60 * 60 * 24 * 7);
    admin.refreshToken = refreshToken;
    admin.refreshTokenExpiresAt = expiresAt;
    await admin.save();
    setCookies(res, accessToken, refreshToken);
    return res.status(currentAdmin ? 200 : 201).json({
      success: true,
      data: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        meetLink: admin.meetLink,
        access: admin.access,
      },
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      const decoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET
      );
      await Admin.findByIdAndUpdate(decoded.adminId, {
        $unset: { refreshToken: 1, refreshTokenExpiresAt: 1 },
      });
    }
    res.clearCookie("accessToken", { httpOnly: true });
    res.clearCookie("refreshToken", { httpOnly: true });
    return res
      .status(200)
      .json({ success: true, message: "Logout successful" });
  } catch (err) {
    return res.status(500).json({ message: "Server error", err: err.message });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res
        .status(401)
        .json({ success: false, message: "Refresh token is required" });
    }
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const admin = await Admin.findById(decoded.adminId);
    if (!admin || admin.refreshToken !== refreshToken) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid refresh token" });
    }
    const accessToken = jwt.sign(
      { adminId: admin._id },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });
    return res
      .status(200)
      .json({ success: true, message: "Token refreshed successfully" });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

export const meetLinkSubmission = async (req, res) => {
  try {
    const { meetLink } = req.body;
    if (!meetLink || meetLink.trim().length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Meet link is required" });
    }
    const admin = req.user;
    admin.meetLink = meetLink;
    await admin.save();
    return res
      .status(200)
      .json({ success: true, message: "Meet link submission successful" });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

export const createSlot = async (req, res) => {
  try {
    const { round, dateTime } = req.body;
    if (!round || ![1, 2, 3].includes(round)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or missing round number" });
    }
    if (!dateTime) {
      return res
        .status(400)
        .json({ success: false, message: "Date and time are required" });
    }
    let dateTimeIST = moment.tz(dateTime, "Asia/Kolkata").toDate();
    const newSlot = new Slot({
      round,
      time: dateTimeIST,
    });
    await newSlot.save();
    return res.status(201).json({
      success: true,
      message: "Slot creation successful",
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

export const fetchAllSlots = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["pending", "ready", "completed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid slot status",
      });
    }
    const filter = {
      status: status === "ready" ? "pending" : status,
      ...(status === "ready" && { isReady: true }),
    };
    const slots = await Slot.find(filter);
    return res.status(200).json({
      success: true,
      data: slots,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

export const takeSlot = async (req, res) => {
  const { slotId } = req.params;
  const admin = req.user;
  if (!mongoose.Types.ObjectId.isValid(slotId)) {
    return res.status(400).json({ success: false, message: "Invalid slot ID" });
  }
  if (!admin.meetLink) {
    return res.status(400).json({
      success: false,
      message: "Meet link not found in admin profile",
    });
  }
  try {
    const slot = await Slot.findOneAndUpdate(
      { _id: slotId, reviewer: null },
      { reviewer: admin._id, meetLink: admin.meetLink },
      { new: true }
    )
      .populate("users", "name email currentRound round0 rounds")
      .populate("admins", "name")
      .populate("reviewer", "name");
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: "Slot not found or already has a reviewer assigned",
      });
    }
    const userEmails = slot.users.map((user) => user.email);
    const subject = "Your Interview Meet Link";
    const message = `<div style="font-family: poppins, sans-serif; padding: 10px;"><h2 style="color: #007bff;">Interview Meet Link</h2><p>Hello,</p><p>Below are your Round details:</p><p><strong>Meet Link:</strong> <a href="${slot.meetLink}" style="color: #28a745; text-decoration: none;">Join Meeting</a></p><p>Please join on time. Wishing you all the best!</p><br><p>Regards,</p><p><strong>IEEE VIT</strong></p></div>`;
    userEmails.forEach((email) => sendMail(email, subject, message));
    return res.status(200).json({
      success: true,
      message: "Reviewer assigned successfully and email sent",
      data: slot,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

export const joinSlot = async (req, res) => {
  const { slotId } = req.params;
  const admin = req.user;
  if (!mongoose.Types.ObjectId.isValid(slotId)) {
    return res.status(400).json({ success: false, message: "Invalid slot ID" });
  }
  try {
    const slot = await Slot.findById(slotId)
      .populate("users", "name email currentRound round0 rounds")
      .populate("admins", "name")
      .populate("reviewer", "name");
    if (!slot) {
      return res
        .status(404)
        .json({ success: false, message: "Slot not found" });
    }
    if (!slot.reviewer) {
      return res.status(400).json({
        success: false,
        message: "Slot does not have a reviewer yet",
      });
    }
    if (slot.admins.some((id) => id.toString() === admin._id.toString())) {
      return res.status(400).json({
        success: false,
        message: "Admin is already assigned to this slot",
      });
    }
    slot.admins.push(admin._id);
    await slot.save();
    return res.status(200).json({
      success: true,
      message: "Admin added to the slot successfully",
      data: slot,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

export const reviewSlots = async (req, res) => {
  const admin = req.user;
  try {
    const slots = await Slot.find({ reviewer: admin._id })
      .populate("users", "name rounds")
      .lean();
    const filteredSlots = slots.filter((slot) => {
      return slot.users?.some((user) => {
        const rounds = user.rounds || {};
        if (slot.round === 1) return rounds.round1?.review === null;
        if (slot.round === 2) return rounds.round2?.review === null;
        if (slot.round === 3) return rounds.round3?.review === null;
        return false;
      });
    });
    return res.status(200).json({
      success: true,
      message: "Slots pending review found",
      data: filteredSlots.map((slot) => ({
        _id: slot._id,
        round: slot.round,
        time: slot.time,
        users:
          slot.users?.map((user) => ({
            _id: user._id,
            name: user.name,
          })) || [],
        reviewer: slot.reviewer,
        status: slot.status,
      })),
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

export const reviewSubmission = async (req, res) => {
  const { slotId, userId } = req.params;
  const { review, taskTitle, taskDescription, taskDeadline } = req.body;
  if (
    !mongoose.Types.ObjectId.isValid(slotId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid slot ID or user ID" });
  }
  if (!review?.trim()) {
    return res
      .status(400)
      .json({ success: false, message: "Review is required" });
  }
  if (!taskTitle?.trim()) {
    return res
      .status(400)
      .json({ success: false, message: "Task title is required" });
  }
  if (!taskDescription?.trim()) {
    return res
      .status(400)
      .json({ success: false, message: "Task Description is required" });
  }
  if (!taskDeadline) {
    return res
      .status(400)
      .json({ success: false, message: "Task deadline is required" });
  }
  const taskDeadlineIST = moment.tz(taskDeadline, "Asia/Kolkata").toDate();
  try {
    const slot = await Slot.findById(slotId).populate("users", "_id");
    if (!slot) {
      return res
        .status(404)
        .json({ success: false, message: "Slot not found" });
    }
    const userExists = slot.users.some(
      (user) => user._id.toString() === userId
    );
    if (!userExists) {
      return res
        .status(403)
        .json({ success: false, message: "User is not part of this slot" });
    }
    const roundKey = `rounds.round${slot.round}`;
    if (
      !["rounds.round1", "rounds.round2", "rounds.round3"].includes(roundKey)
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid round number in slot" });
    }
    const updateData = {
      [`${roundKey}.review`]: review,
      [`${roundKey}.status`]: "completed",
    };
    if (slot.round !== 3) {
      updateData[`${roundKey}.taskTitle`] = taskTitle;
      updateData[`${roundKey}.taskDescription`] = taskDescription;
      updateData[`${roundKey}.taskDeadline`] = taskDeadlineIST;
    }
    const updateQuery = { $set: updateData };
    if (slot.round !== 3) {
      updateQuery.$inc = { currentRound: 1 };
    }
    await User.updateOne({ _id: userId }, updateQuery);
    slot.status = "completed";
    return res.status(200).json({
      success: true,
      message: "Review submission successful",
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

export const round0Elimination = async (req, res) => {
  try {
    const result = await User.updateMany(
      { isFresher: false },
      { $set: { isEliminated: true } }
    );
    return res.status(200).json({
      success: true,
      message: "Round 0 elimination successful",
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

export const round1Elimination = async (req, res) => {
  try {
    const result = await User.updateMany(
      { "rounds.round1.taskSubmitted": false },
      { $set: { isEliminated: true } }
    );
    return res.status(200).json({
      success: true,
      message: "Round 1 elimination successful",
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

export const round2Elimination = async (req, res) => {
  try {
    const result = await User.updateMany(
      { "rounds.round2.taskSubmitted": false },
      { $set: { isEliminated: true } }
    );
    return res.status(200).json({
      success: true,
      message: "Round 2 elimination successful",
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};
