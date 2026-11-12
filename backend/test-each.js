import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import http from "node:http"
import test from "node:test"
import express from "express"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { AiPort } from "./ai/port.js"
import { AiOrchestrator } from "./ai/orchestrator.js"
import { normalizeFeedback } from "./ai/normalizer.js"
import { OpenRouterAdapter } from "./ai/adapters/openrouter.js"
import User from "./models/User.js"
import Note from "./models/Note.js"
import Message from "./models/Messages.js"
import Usage from "./models/Usage.js"
import Group from "./models/Group.js"
import authRouter from "./routes/Auth.js"
import notesRouter from "./routes/Note.js"
import aiRouter from "./routes/Ai.js"
import { authenticate } from "./middleware/Auth.js"
import { buildChatContext } from "./utils/context.js"
import { orchestrator } from "./ai/index.js"
import { enqueueAIJob } from "./ai/queue.js"

process.env.JWT_SECRET ||= "backend-test-secret"

async function withApp(router, mountPath, callback) {
  const app = express()
  app.use(express.json())
  app.use(mountPath, router)
  app.use((error, req, res, next) => {
    if (error.name === "ZodError") {
      return res.status(400).json({ success: false, error: "Validation failed" })
    }
    next(error)
  })
  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()

  try {
    await callback(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
}

function tokenFor(userId = "test-user") {
  return jwt.sign({ userId, username: "test_user" }, process.env.JWT_SECRET)
}

function replaceMethods(target, replacements) {
  const originals = Object.fromEntries(
    Object.keys(replacements).map((key) => [key, target[key]])
  )
  Object.assign(target, replacements)
  return () => Object.assign(target, originals)
}

test("ai/normalizer.js normalizes JSON and plain text feedback", () => {
  assert.deepEqual(normalizeFeedback('```json\n{"critique":"Clear note"}\n```'), {
    critique: "Clear note",
    suggestions: [],
  })
  assert.deepEqual(normalizeFeedback("Useful draft"), {
    critique: "Useful draft",
    suggestions: [],
  })
})

test("ai/port.js defines the adapter contract", async () => {
  const port = new AiPort()
  await assert.rejects(port.embed("text"), /not implemented/)
  await assert.rejects(port.generateFeedback("title", "content"), /not implemented/)
  await assert.rejects(port.chat([], () => {}), /not implemented/)
  await assert.rejects(port.generateTags("title", "content"), /not implemented/)
})

test("ai/orchestrator.js delegates tag generation to the matching adapter method", async () => {
  const calls = []
  const adapter = {
    generateTags: async (...args) => {
      calls.push(["generateTags", ...args])
      return ["tag"]
    },
    chat: async (...args) => {
      calls.push(["chat", ...args])
      return "unexpected"
    },
  }
  const result = await new AiOrchestrator(adapter).generateTags("title", "content")
  assert.deepEqual(result, ["tag"])
  assert.deepEqual(calls, [["generateTags", "title", "content"]])
})

test("ai/adapters/openrouter.js parses embeddings and feedback responses", async (t) => {
  const originalFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options })
    const payload = url.endsWith("/embeddings")
      ? { data: [{ embedding: [0.1, 0.2] }] }
      : {
          choices: [{
            message: {
              content: requests.length === 2
                ? '{"critique":"Good","suggestions":[]}'
                : "mind, notes",
            },
          }],
        }
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const adapter = new OpenRouterAdapter()
  assert.deepEqual(await adapter.embed("hello"), [0.1, 0.2])
  assert.equal(await adapter.generateFeedback("title", "content"), "Good")
  assert.deepEqual(await adapter.generateTags("title", "content"), ["mind", "notes"])
  assert.equal(requests.length, 3)
})

test("ai/adapters/openrouter.js preserves SSE frames split across network reads", async (t) => {
  const originalFetch = globalThis.fetch
  const encoder = new TextEncoder()
  const frame = 'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n'
  const chunks = [frame.slice(0, 17), frame.slice(17)].map((value) => encoder.encode(value))
  globalThis.fetch = async () => ({
    ok: true,
    body: {
      getReader: () => ({
        read: async () => chunks.length
          ? { done: false, value: chunks.shift() }
          : { done: true },
      }),
    },
  })
  t.after(() => { globalThis.fetch = originalFetch })

  const received = []
  await new OpenRouterAdapter().chat([], (chunk) => received.push(chunk))
  assert.deepEqual(received, ["hello"])
})

test("models/Group.js exposes a timestamped group schema", () => {
  assert.ok(Group.schema instanceof mongoose.Schema)
  assert.equal(Group.schema.options.timestamps, true)
})

test("models/Note.js exposes the expected AI lifecycle states", () => {
  assert.ok(Note.schema instanceof mongoose.Schema)
  assert.equal(Note.schema.path("aiStatus").enumValues.join(","), "pending,done,failed,quota_exceeded")
})

test("models/Usage.js enforces one usage record per user and month", () => {
  const compoundIndex = Usage.schema.indexes().find(([keys, options]) =>
    keys.userId === 1 && keys.month === 1 && options.unique
  )
  assert.ok(compoundIndex)
})

test("models/Messages.js exposes a message schema", () => {
  assert.ok(Message.schema instanceof mongoose.Schema)
})

test("models/User.js exposes a user schema", () => {
  assert.ok(User.schema instanceof mongoose.Schema)
})

test("ai/queue.js processes a queued job using its injected boundaries", async (t) => {
  let resolveUpdate
  const updated = new Promise((resolve) => { resolveUpdate = resolve })
  const restoreNote = replaceMethods(Note, {
    findByIdAndUpdate: async (noteId, update) => {
      resolveUpdate({ noteId, update })
    },
  })
  const restoreUsage = replaceMethods(Usage, {
    findOneAndUpdate: async () => ({ aiCalls: 1 }),
  })
  const restoreAi = replaceMethods(orchestrator, {
    embed: async () => [0.1, 0.2],
    generateTags: async () => ["test"],
    generateFeedback: async () => "Looks good",
  })
  t.after(() => {
    restoreAi()
    restoreUsage()
    restoreNote()
  })

  enqueueAIJob("note-1", "Test", "Body", "user-1")
  const result = await Promise.race([
    updated,
    new Promise((_, reject) => setTimeout(() => reject(new Error("queue timed out")), 1000)),
  ])
  assert.equal(result.noteId, "note-1")
  assert.equal(result.update.aiStatus, "done")
  assert.deepEqual(result.update.embedding, [0.1, 0.2])
  assert.deepEqual(result.update.tags, ["test"])
  assert.equal(result.update.aiFeedback, "Looks good")
})

test("models/Messages.js uses the stable Message model name", () => {
  assert.equal(Message.modelName, "Message")
})

test("models/User.js enables Mongoose timestamps", () => {
  assert.equal(User.schema.options.timestamps, true)
})

test("middleware/Auth.js rejects missing and invalid bearer tokens", async () => {
  for (const authorization of [undefined, "Bearer invalid-token"]) {
    let responseStatus
    let responseBody
    let advanced = false
    const req = { headers: authorization ? { authorization } : {} }
    const res = {
      status(status) {
        responseStatus = status
        return this
      },
      json(body) {
        responseBody = body
        return this
      },
    }
    authenticate(req, res, () => { advanced = true })
    assert.equal(advanced, false)
    assert.ok([401, 403].includes(responseStatus))
    assert.equal(responseBody.success, false)
  }
})

test("middleware/Auth.js accepts a correctly signed token", () => {
  const req = { headers: { authorization: `Bearer ${tokenFor("user-42")}` } }
  let nextCalled = false
  authenticate(req, { status() { return this }, json() {} }, () => { nextCalled = true })
  assert.equal(req.userId, "user-42")
  assert.equal(nextCalled, true)
})

test("utils/context.js includes persisted chat history in model context", async (t) => {
  const rows = [
    { role: "user", content: "Earlier question" },
    { role: "assistant", content: "Earlier answer" },
  ]
  const restore = replaceMethods(Message, {
    find: () => ({
      sort() { return this },
      lean() { return Promise.resolve(rows) },
    }),
  })
  t.after(restore)

  const context = await buildChatContext("note-1", "Current note")
  assert.deepEqual(context.slice(2), rows)
})

test("routes/Auth.js validates registration input without a database", async (t) => {
  const restore = replaceMethods(User, {
    findOne: async () => null,
    create: async (document) => ({
      _id: "user-1",
      displayUsername: document.displayUsername,
    }),
  })
  t.after(restore)

  await withApp(authRouter, "/api/auth", async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "test_user", email: "bad", password: "short" }),
    })
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error, "Validation failed")
  })
})

test("routes/Auth.js normalizes username lookups during login", async (t) => {
  let lookup
  const restore = replaceMethods(User, {
    findOne: async (query) => {
      lookup = query
      return null
    },
  })
  t.after(restore)

  await withApp(authRouter, "/api/auth", async (baseUrl) => {
    await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Test_User", password: "password123" }),
    })
    assert.equal(lookup.username, "test_user")
  })
})

test("routes/Note.js requires authentication before touching notes", async () => {
  await withApp(notesRouter, "/api/notes", async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/notes`)
    assert.equal(response.status, 401)
  })
})

test("routes/Note.js scopes note reads to the authenticated owner", async (t) => {
  let filter
  const restore = replaceMethods(Note, {
    findOne: (query) => {
      filter = query
      return { lean: async () => null }
    },
  })
  t.after(restore)

  await withApp(notesRouter, "/api/notes", async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/notes/507f1f77bcf86cd799439011`, {
      headers: { Authorization: `Bearer ${tokenFor("owner-1")}` },
    })
    assert.equal(response.status, 404)
    assert.equal(filter.userId, "owner-1")
  })
})

test("routes/Ai.js rejects malformed note IDs before provider/database work", async () => {
  await withApp(aiRouter, "/api/ai", async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/ai/notes/not-an-id/feedback`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenFor()}` },
    })
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error, "Invalid note ID")
  })
})

test("ai/index.js and ai/queue.js expose their runtime entry points", () => {
  assert.equal(typeof orchestrator.embed, "function")
  assert.equal(typeof orchestrator.chat, "function")
  assert.equal(typeof enqueueAIJob, "function")
})

test("server.js and every production module pass Node's syntax check", async () => {
  const sourceFiles = [
    "server.js",
    "middleware/Auth.js",
    "models/Group.js",
    "models/Messages.js",
    "models/Note.js",
    "models/Usage.js",
    "models/User.js",
    "routes/Ai.js",
    "routes/Auth.js",
    "routes/Note.js",
    "utils/context.js",
    "ai/adapters/openrouter.js",
    "ai/index.js",
    "ai/normalizer.js",
    "ai/orchestrator.js",
    "ai/port.js",
    "ai/queue.js",
  ]

  for (const file of sourceFiles) {
    const result = spawnSync(process.execPath, ["--check", new URL(file, import.meta.url).pathname], {
      encoding: "utf8",
    })
    assert.equal(result.status, 0, `${file} failed syntax check:\n${result.stderr}`)
  }
})

test("legacy ai/test.js is syntactically valid", async () => {
  const source = await readFile(new URL("./ai/test.js", import.meta.url), "utf8")
  assert.ok(source.length > 0)
  const result = spawnSync(process.execPath, ["--check", new URL("./ai/test.js", import.meta.url).pathname], {
    encoding: "utf8",
  })
  assert.equal(result.status, 0, result.stderr)
})