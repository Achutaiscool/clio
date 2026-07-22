import mongoose from "mongoose"

const noteSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    time: {
      type: Date,
      required: true,
    }
  },
  {
    timestamps: true
  }
)

export default mongoose.model("Note", noteSchema)