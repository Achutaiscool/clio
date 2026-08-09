import { Router } from "express"
import { z } from "zod"
import Note from "../models/Note.js"
import { authenticate } from "../middleware/Auth.js"

const router = Router()

const createSchema = z.object({
    title:z.string().max(200).optional(),
    content: z.string().max(50000).default("")
})

const updateSchema = z.object({
    title: z.string().max(200).optional(),
    content: z.string().max(50000).optional()
}).refine(
    data=> data.title !== undefined || data.content !== undefined,
    {message: " At least one field must be provided "}
)

const asyncHandler= (fn) => (req, res, next)=>{
    Promise.resolve(fn(req, res, next)).catch(next)
}

router.post("/", authenticate, asyncHandler(async (req, res)=>{
    const { title, content}= createSchema.parse(req.body)

    const note= await Note.create({
        userId: req.userId,
        title:title?.trim() || "Untitled",
        content
    })

    res.status(201).json({ success: true, noteId: note._id })

}))
/* */
router.get("/", authenticate, asyncHandler(async (req, res)=>{
    const page = Math.max( parseInt( req.query.page ) || 1,1 )
    const limit = Math.min( parseInt( req.query.limit ) || 20,100 )

    const [notes, totalCount]= await Promise.all([
        Note.find({ userId: req.userId })
            .sort({ updatedAt:-1 })
            .skip((page - 1)*limit)
            .limit(limit)
            .lean(),
        Note.countDocuments({ userId: req.userId})
    ])

    res.json({
        success:true,
        data: notes,
        pagination:{
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasNextPage: page * limit < totalCount,
            hasPrevPage: page > 1
        }
    })
}))
/* */
router.get("/:id", authenticate, asyncHandler(async (req, res)=>{
    const note = await Note.findOne({
        _id: req.params.id,
        userId: req.userId
    }).lean()

    if(!note){
        return res.status(404).json({ success: false, error: "Note not found" })
    }

    res.json({ success: true, data: note})
}))

router.put("/:id", authenticate, asyncHandler(async (req, res)=>{
    const updates =updateSchema.parse(req.body)

    const note = await Note.findOneAndUpdate(
        { _id: req.params.id, userId: req.userId },
        { ...updates, updatedAt: new Date()},
        { new: true}
    )

    if(!note){
        return res.status(404).json({ success: false, error: "Note not found" })
    }

    res.json({ success: true, data: note})
}))

router.delete("/:id", authenticate, asyncHandler(async (req, res)=>{
    const result = await Note.deleteOne({
        _id: req.params.id,
        userId: req.userId
    })

    if(result.deletedCount === 0){
        return res.status(404).json({ success: false, error: "Note not found" })
    }

    res.json({ success: true, data: {deleted: true}})
}))

export default router