import mongoose from "mongoose";
import moment from "moment-timezone";

const userSchema = new mongoose.Schema(
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
    picture: {
      type: String,
    },
    isFresher: {
      type: Boolean,
      default: false,
    },
    isEliminated: {
      type: Boolean,
      default: false,
    },
    currentRound: {
      type: Number,
      min: 0,
      max: 3,
      default: 0,
    },
    round0: {
      contactNo: {
        type: Number,
        match: [/^[6789]\d{9}$/, "Invalid contact number"],
        default: null,
      },
      branch: {
        type: String,
        default: null,
      },
      githubProfile: {
        type: String,
        match: [
          /^(https:\/\/github\.com\/)?[a-zA-Z0-9-]+\/?$/,
          "Invalid github profile",
        ],
        default: null,
      },
      projectLink: {
        type: String,
        default: null,
      },
      projectText: {
        type: String,
        default: null,
      },
      domain: {
        type: [String],
        default: [],
      },
      answer1: {
        type: String,
        default: null,
      },
      answer2: {
        type: String,
        default: null,
      },
      answer3: {
        type: String,
        default: null,
      },
      answer4: {
        type: String,
        default: null,
      },
      answer5: {
        type: String,
        default: null,
      },
      // answer6: {
      //   type: String,
      //   default: null,
      // },
      managementQuestion: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
      },
      managementAnswer: {
        type: String,
        default: null,
      },
      status: {
        type: String,
        enum: ["pending", "completed"],
        default: "pending",
      },
    },
    rounds: {
      round1: {
        review: {
          type: String,
          default: null,
        },
        taskTitle: {
          type: String,
          default: null,
        },
        taskDescription: {
          type: String,
          default: null,
        },
        taskLink: {
          type: String,
          default: null,
        },
        taskDeadline: {
          type: Date,
        },
        taskSubmitted: {
          type: Boolean,
          default: false,
        },
        status: {
          type: String,
          enum: ["upcoming", "pending", "completed"],
          default: "upcoming",
        },
      },
      round2: {
        review: {
          type: String,
          default: null,
        },
        taskTitle: {
          type: String,
          default: null,
        },
        taskDescription: {
          type: String,
          default: null,
        },
        taskLink: {
          type: String,
          default: null,
        },
        taskDeadline: {
          type: Date,
        },
        taskSubmitted: {
          type: Boolean,
          default: false,
        },
        status: {
          type: String,
          enum: ["upcoming", "pending", "completed"],
          default: "upcoming",
        },
      },
      round3: {
        review: {
          type: String,
          default: null,
        },
        status: {
          type: String,
          enum: ["upcoming", "pending", "completed"],
          default: "upcoming",
        },
      },
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

userSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.time = moment(ret.time).tz("Asia/Kolkata").format("YYYY-MM-DDTHH:mm");
    return ret;
  },
});

const User = mongoose.model("User", userSchema);

export default User;
