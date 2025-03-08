import jwt from "jsonwebtoken";
import moment from "moment-timezone";
import mongoose from "mongoose";
import { generateTokens, setCookies } from "../lib/auth.js";
import User from "../models/user.model.js";
import Slot from "../models/slot.model.js";

const isProduction = process.env.NODE_ENV === "production";

export const fetchUserData = async (req, res) => {
  try {
    const user = req.user;
    const slot = await Slot.findOne({
      round: user.currentRound,
      users: user._id,
    });
    return res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isEliminated: user.isEliminated,
        currentRound: user.currentRound,
        round0Status: user.round0.status,
        round1Status: user.rounds.round1.status,
        round2Status: user.rounds.round2.status,
        round3Status: user.rounds.round3.status,
        slot: slot
          ? {
              _id: slot._id,
              round: slot.round,
              dateTime: slot.time
                ? moment(slot.time)
                    .tz("Asia/Kolkata")
                    .format("YYYY-MM-DDTHH:mm:ss")
                : null,
              isAvailable: slot.isAvailable,
              isReady: slot.isReady,
              meetLink: slot.meetLink,
              status: slot.status,
            }
          : null,
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: "Server log error",
      error: err.message,
    });
  }
};

export const login = async (req, res) => {
  const { name, email } = req.user;
  const deviceId = req.body.deviceId;
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
  if (!deviceId) {
    return res
      .status(400)
      .json({ success: false, message: "Device ID is required" });
  }
  const regNoIndex = name.lastIndexOf(" ");
  const userName = name.slice(0, regNoIndex).trim();
  const regNo = name.slice(regNoIndex + 1).trim();
  const isFresher = regNo.startsWith("24");
  try {
    const currentUser = await User.findOne({ email });
    let user, slot;
    if (currentUser) {
      user = currentUser;
      slot = await Slot.findOne({
        round: user.currentRound,
        users: user._id,
      });
    } else {
      user = await User.create({ name: userName, email, isFresher });
    }
    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens = user.refreshTokens.filter(
      (t) => t.deviceId !== deviceId
    );
    user.refreshTokens.push({
      token: refreshToken,
      deviceId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await user.save();
    setCookies(res, accessToken, refreshToken);
    return res.status(currentUser ? 200 : 201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isEliminated: user.isEliminated,
        currentRound: user.currentRound,
        round0Status: user.round0.status,
        round1Status: user.rounds.round1.status,
        round2Status: user.rounds.round2.status,
        round3Status: user.rounds.round3.status,
        slot: slot
          ? {
              _id: slot._id,
              round: slot.round,
              isAvailable: slot.isAvailable,
              isReady: slot.isReady,
              meetLink: slot.meetLink,
              status: slot.status,
            }
          : null,
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
      await User.findByIdAndUpdate(decoded.userId, {
        $pull: { refreshTokens: { token: refreshToken } },
      });
    }
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "None",
      path: "/",
    });
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "None",
      path: "/",
    });
    return res
      .status(200)
      .json({ success: true, message: "Logout successful" });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
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
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ success: false, message: "Expired refresh token" });
    }
    const user = await User.findById(decoded.userId);
    if (!user || !user.refreshTokens.find((t) => t.token === refreshToken)) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid refresh token" });
    }
    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "None",
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

export const round0Submission = async (req, res) => {
  try {
    const user = req.user;
    const {
      contactNo,
      githubProfile,
      projectLink,
      projectText,
      domain,
      answer1,
      answer2,
      answer3,
      answer4,
      answer5,
      managementQuestion,
      managementAnswer,
    } = req.body;
    if (!contactNo || !/^[6789]\d{9}$/.test(contactNo)) {
      return res.status(400).json({
        success: false,
        message: "Valid contact number is required",
      });
    }
    if (
      githubProfile &&
      /^https:\/\/github\.com\/[a-zA-Z0-9-]+\/?$/.test(githubProfile)
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Valid GitHub profile is required" });
    }
    if (!domain || !Array.isArray(domain) || domain.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Domain selection is required" });
    }
    if (domain.length > 2) {
      return res
        .status(400)
        .json({ success: false, message: "Only two domain are allowed" });
    }
    const answers = [
      answer1,
      answer2,
      // answer3,
      answer4,
      // answer5,
      managementAnswer,
    ];
    if (answers.some((ans) => !ans || ans.trim().length === 0)) {
      return res
        .status(400)
        .json({ success: false, message: "All answers are required" });
    }
    if (
      typeof managementQuestion !== "number" ||
      ![1, 2, 3].includes(managementQuestion)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid management question",
      });
    }
    if (user.currentRound === 0 && user.round0.status === "pending") {
      user.round0 = {
        contactNo,
        githubProfile: githubProfile || null,
        projectLink: projectLink || null,
        projectText: projectText || null,
        domain,
        answer1,
        answer2,
        answer3: answer3 || null,
        answer4,
        answer5: answer5 || null,
        managementQuestion,
        managementAnswer,
      };
      user.round0.status = "completed";
      user.currentRound = 1;
      await user.save();
      return res.status(200).json({
        success: true,
        message: "Round 0 submission successful",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "You are not eligible for Round 0 submission",
      });
    }
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

export const fetchAvailableSlots = async (req, res) => {
  const user = req.user;
  if (
    user.rounds[`round${user.currentRound}`]?.status === "completed" ||
    user.rounds[`round${user.currentRound}`]?.status === "pending"
  ) {
    return res.status(403).json({
      success: false,
      message: `Round ${user.currentRound} is already ${
        user.rounds[`round${user.currentRound}`].status
      }`,
    });
  }
  try {
    const currentTimeIST = moment().tz("Asia/Kolkata").toDate();
    const slots = await Slot.find({
      round: user.currentRound,
      isAvailable: true,
      time: { $gte: currentTimeIST },
    });
    return res
      .status(200)
      .json({ success: true, totalSlots: slots.length, data: slots });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

export const selectSlot = async (req, res) => {
  try {
    const user = req.user;
    const { slotId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(slotId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid slot ID" });
    }
    const slot = await Slot.findById(slotId);
    if (!slot) {
      return res.status(404).json({ message: "Slot not found" });
    }
    if (!slot.isAvailable) {
      return res.status(400).json({ message: "Slot is not available" });
    }
    const max = 3;
    if (!slot.users) {
      slot.users = [];
    }
    if (slot.round === 1) {
      if (["completed", "pending"].includes(user.rounds.round1.status)) {
        return res.status(400).json({
          success: false,
          message: `Your slot is already ${user.rounds.round1.status}`,
        });
      }
      slot.users = [user._id];
      slot.isAvailable = false;
      slot.status = "pending";
      user.rounds.round1.status = "pending";
    } else if (slot.round === 2) {
      if (["completed", "pending"].includes(user.rounds.round2.status)) {
        return res.status(400).json({
          success: false,
          message: `Your slot is already ${user.rounds.round2.status}`,
        });
      }
      if (!slot.users.includes(user._id)) {
        if (slot.users.length < max) {
          slot.users.push(user._id);
          slot.status = "pending";
          slot.isAvailable = slot.users.length < max;
          user.rounds.round2.status = "pending";
        } else {
          return res.status(400).json({ message: "Slot is full" });
        }
      }
    } else if (slot.round === 3) {
      if (["completed", "pending"].includes(user.rounds.round3.status)) {
        return res.status(400).json({
          success: false,
          message: `Your slot is already ${user.rounds.round2.status}`,
        });
      }
      slot.users = [user._id];
      slot.isAvailable = false;
      slot.status = "pending";
      user.rounds.round3.status = "pending";
    }
    await slot.save();
    await user.save();
    res.status(200).json({
      success: true,
      message: "Slot selection successful",
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

export const ready = async (req, res) => {
  try {
    const user = req.user;
    const { slotId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(slotId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid slot ID" });
    }
    const slot = await Slot.findById(slotId);
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: "Slot not found",
      });
    }
    if (!slot.users.includes(user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: "User is not part of this slot",
      });
    }
    slot.isReady = true;
    await slot.save();
    return res.status(200).json({
      success: true,
      message: "Kindly check your mail for meet link",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

export const taskSubmission = async (req, res) => {
  try {
    const user = req.user;
    const { taskLink } = req.body;
    if (!taskLink || taskLink.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Task link is required",
      });
    }
    const roundKey = `rounds.round${user.currentRound - 1}.taskLink`;
    const currentTimeIST = moment().tz("Asia/Kolkata").toDate();
    if (
      user.currentRound === 2 &&
      !user.rounds.round1.taskSubmitted &&
      user.rounds.round1.taskDeadline &&
      moment(user.rounds.round1.taskDeadline).isAfter(currentTimeIST)
    ) {
      user.set(roundKey, taskLink);
      user.rounds.round1.taskSubmitted = true;
    } else if (
      user.currentRound === 3 &&
      !user.rounds.round2.taskSubmitted &&
      user.rounds.round2.taskDeadline &&
      moment(user.rounds.round2.taskDeadline).isAfter(currentTimeIST)
    ) {
      user.set(roundKey, taskLink);
      user.rounds.round2.taskSubmitted = true;
    } else {
      return res.status(400).json({
        success: false,
        message: "You are not eligible for task submission",
      });
    }
    await user.save();
    return res.status(200).json({
      success: true,
      message: "Task submission successful",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};
