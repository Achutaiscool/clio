import mongoose from "mongoose"

const groupSchema = new mongoose.Schema(
  {
    userId: {
      type: String,  
      required: true,
    },
    groupName: {
      type: String,
      required: true,
    },
    noteIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Note'
      }
    ]
  },
  {
    timestamps: true
  }
)

export default mongoose.model("Group", groupSchema)