import moment from "moment-timezone";
import mongoose from "mongoose";

const slotSchema = new mongoose.Schema(
  {
    round: {
      type: Number,
      required: true,
      min: 1,
      max: 3,
    },
    time: {
      type: Date,
      required: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    meetLink: {
      type: String,
      default: null,
    },
    users: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    isReady: {
      type: Boolean,
      default: false,
    },
    admins: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Admin",
      default: [],
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    status: {
      type: String,
      enum: ["upcoming", "pending", "completed", "missed"],
      default: "upcoming",
    },
  },
  { timestamps: true }
);

slotSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.time = moment(ret.time).tz("Asia/Kolkata").format("YYYY-MM-DDTHH:mm");
    return ret;
  },
});

const Slot = mongoose.model("Slot", slotSchema);

export default Slot;
