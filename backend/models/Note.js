import mongoose from "mongoose"

const noteSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    content: { type: String, required: true, default: "" },
    embedding: { type: [Number] },
    tags: [{ type: String }],
    aiFeedback: { type: String },
    aiStatus: {
      type: String,
      enum: ["pending", "done", "failed", "quota_exceeded"],
      default: "pending",
    },
    aiProcessedAt: { type: Date },
    groupId: { type: String, index: true },
  },
  { timestamps: true }
)

export default mongoose.model("Note", noteSchema)
