import mongoose from "mongoose";
import ROLES from "../constants/roles.js";

const notificationPreferencesSchema = new mongoose.Schema(
  {
    newFollower: { type: Boolean, default: true },
    newComment: { type: Boolean, default: true },
    newLike: { type: Boolean, default: true }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 8
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER
    },
    bio: {
      type: String,
      maxlength: 300,
      default: ""
    },
    avatarUrl: {
      type: String,
      default: ""
    },
    notificationPreferences: {
      type: notificationPreferencesSchema,
      default: () => ({})
    },
    active: {
      type: Boolean,
      default: true
    },
    accountStatus: {
      type: String,
      enum: ['active', 'suspended', 'banned'],
      default: 'active'
    }
  },
  { timestamps: true }
);

// Never return the password in query results
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const User = mongoose.model("User", userSchema);

export default User;