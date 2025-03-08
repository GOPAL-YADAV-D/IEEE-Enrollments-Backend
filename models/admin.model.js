import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    meetLink: {
      type: String,
      default: null,
    },
    access: {
      type: Boolean,
      default: false,
    },
    refreshTokens: [
      {
        token: String,
        deviceId: String,
        expiresAt: Date,
      },
    ],
  },
  { timestamps: true }
);

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;
