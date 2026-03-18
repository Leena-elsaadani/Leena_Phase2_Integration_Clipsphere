import mongoose from "mongoose";

const followerSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

// Prevent duplicate follow relationships
followerSchema.index({ follower: 1, following: 1 }, { unique: true });

// Efficiently query "who follows userId" and "who does userId follow"
followerSchema.index({ following: 1 });
followerSchema.index({ follower: 1 });

const Follower = mongoose.model("Follower", followerSchema);

export default Follower;