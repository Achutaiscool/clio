// routes/AI.js
import { Router } from "express"
import mongoose from "mongoose"
import Note from "../models/Note.js"
import Message from "../models/Messages.js"
import { authenticate } from "../middleware/Auth.js"
import { buildChatContext } from "../utils/context.js"
import { orchestrator } from "../ai/index.js"

const router = Router()

// ─────────────────────────────────────────────────────
// Middleware: verify user owns the note
// ─────────────────────────────────────────────────────
async function requireNoteOwnership(req, res, next) {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid note ID" })
    }

    const note = await Note.findOne({ _id: id, userId: req.userId }).lean()
    if (!note) {
      return res.status(404).json({ error: "Note not found" })
    }

    req.note = note
    next()
  } catch (err) {
    next(err)
  }
}

// ─────────────────────────────────────────────────────
// POST /notes/:id/feedback
// ─────────────────────────────────────────────────────
router.post(
  "/notes/:id/feedback",
  authenticate,
  requireNoteOwnership,
  async (req, res, next) => {
    try {
      const note = req.note

      if (note.aiFeedback) {
        return res.json({ feedback: note.aiFeedback })
      }

      const feedback = await orchestrator.generateFeedback(note.title, note.content)

      await Note.findByIdAndUpdate(note._id, { aiFeedback: feedback })

      await Message.create({
        noteId: note._id,
        userId: req.userId,
        role: "assistant",
        content: feedback,
      })

      return res.json({ feedback })
    } catch (err) {
      next(err)
    }
  }
)

// ─────────────────────────────────────────────────────
// POST /notes/:id/chat — SSE stream
// ─────────────────────────────────────────────────────
router.post(
  "/notes/:id/chat",
  authenticate,
  requireNoteOwnership,
  async (req, res, next) => {
    try {
      const { message } = req.body
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message body required" })
      }

      const note = req.note

      await Message.create({
        noteId: note._id,
        userId: req.userId,
        role: "user",
        content: message,
      })

      const messages = await buildChatContext(note._id.toString(), note.content)

      res.setHeader("Content-Type", "text/event-stream")
      res.setHeader("Cache-Control", "no-cache")
      res.setHeader("Connection", "keep-alive")

      let fullResponse = ""

      await orchestrator.chat(messages, (chunk) => {
        fullResponse += chunk
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
      })

      await Message.create({
        noteId: note._id,
        userId: req.userId,
        role: "assistant",
        content: fullResponse,
      })

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
      res.end()
    } catch (err) {
      if (res.headersSent) {
        res.write(
          `event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`
        )
        return res.end()
      }
      next(err)
    }
  }
)

// ─────────────────────────────────────────────────────
// GET /notes/:id/chat — history
// ─────────────────────────────────────────────────────
router.get(
  "/notes/:id/chat",
  authenticate,
  requireNoteOwnership,
  async (req, res, next) => {
    try {
      const messages = await Message.find({ noteId: req.note._id })
        .sort({ createdAt: 1 })
        .select("role content createdAt")
        .lean()

      res.json({ messages })
    } catch (err) {
      next(err)
    }
  }
)

export default router
