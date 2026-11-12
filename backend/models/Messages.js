import mongoose from "mongoose"

const messageSchema = new mongoose.Schema(
    {
        noteId: { type: String, required: true, index: true },
        userId: { type: String, required: true, index: true },
        role: {
            type: String,
            enum: ["user", "assistant"],
            required: true,
        },

        content: { type: String, required: true },
    },

    { timestamps: true}
) 

export default mongoose.model(" Message ", messageSchema)