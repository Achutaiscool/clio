import mongoose from "mongoose"

const usageSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  month: { type: String, required: true },
  aiCalls: { type: Number, default: 0 },
})

usageSchema.index({ userId: 1, month: 1 }, { unique: true })
export default mongoose.model("Usage", usageSchema)