// test-ai-e2e.js
// End-to-end test for the entire MindWeave backend including AI layer.
// Usage: node test-ai-e2e.js

const BASE_URL = process.env.BASE_URL || "http://localhost:5000"
const WAIT_FOR_AI_MS = 30000
const POLL_INTERVAL_MS = 2000

// ─── Colors ───────────────────────────────────────────────
const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
}

let passed = 0
let failed = 0

function pass(name) {
  console.log(`  ${c.green("✅ PASS")}  ${name}`)
  passed++
}

function fail(name, reason) {
  console.log(`  ${c.red("❌ FAIL")}  ${name}`)
  console.log(`     ${c.dim(reason)}`)
  failed++
}

function section(title) {
  console.log(`\n${c.cyan(c.bold(`━━━ ${title} ━━━`))}`)
}

function info(msg) {
  console.log(`  ${c.dim(msg)}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ─── HTTP helpers ─────────────────────────────────────────
async function http(method, path, { token, body, headers = {} } = {}) {
  const h = { "Content-Type": "application/json", ...headers }
  if (token) h.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  return { status: res.status, data, headers: res.headers }
}

// ─── State ────────────────────────────────────────────────
const state = {
  username: `aitest_${Date.now()}`,
  email: `ai_${Date.now()}@test.com`,
  password: "password123",
  token: null,
  noteId: null,
}

// ─── Tests ────────────────────────────────────────────────

async function testHealth() {
  section("Health Check")

  const { status, data } = await http("GET", "/health")
  if (status === 200 && data?.status === "ok") {
    pass(`GET /health → ${data.db}`)
  } else {
    fail("GET /health", `status=${status}, body=${JSON.stringify(data)}`)
  }
}

async function testRegister() {
  section("Auth: Register")

  const { status, data } = await http("POST", "/api/auth/register", {
    body: {
      username: state.username,
      email: state.email,
      password: state.password,
    },
  })

  if (status === 201 && data?.success) {
    pass(`POST /api/auth/register → 201`)
  } else {
    fail("POST /api/auth/register", `status=${status}, body=${JSON.stringify(data)}`)
  }
}

async function testLogin() {
  section("Auth: Login")

  const { status, data } = await http("POST", "/api/auth/login", {
    body: { username: state.username, password: state.password },
  })

  if (status === 200 && data?.data?.token) {
    state.token = data.data.token
    pass(`POST /api/auth/login → token (${data.data.token.slice(0, 20)}...)`)
  } else {
    fail("POST /api/auth/login", `status=${status}, body=${JSON.stringify(data)}`)
  }
}

async function testCreateNote() {
  section("Notes: Create (should trigger AI queue)")

  const { status, data } = await http("POST", "/api/notes", {
    token: state.token,
    body: {
      title: "Machine Learning in Healthcare",
      content:
        "Machine learning is transforming healthcare through predictive diagnostics, " +
        "personalized treatments, and early disease detection. Neural networks can " +
        "analyze medical images faster than human radiologists.",
    },
  })

  if (status === 201 && data?.noteId) {
    state.noteId = data.noteId
    pass(`POST /api/notes → noteId=${data.noteId}, aiStatus=${data.aiStatus || "?"}`)
  } else {
    fail("POST /api/notes", `status=${status}, body=${JSON.stringify(data)}`)
  }
}

async function testGetNoteUnauthed() {
  section("Notes: GET without auth (should 401)")

  const { status } = await http("GET", `/api/notes/${state.noteId}`)
  if (status === 401) {
    pass("GET /api/notes/:id without token → 401")
  } else {
    fail("Unauthed GET", `expected 401, got ${status}`)
  }
}

async function testWaitForAI() {
  section("AI Queue: Wait for processing")

  info(`Polling /api/notes/${state.noteId} every ${POLL_INTERVAL_MS}ms (max ${WAIT_FOR_AI_MS}ms)`)
  const start = Date.now()
  let lastStatus = null

  while (Date.now() - start < WAIT_FOR_AI_MS) {
    const { status, data } = await http("GET", `/api/notes/${state.noteId}`, {
      token: state.token,
    })

    if (status !== 200 || !data?.data) {
      fail("Poll note", `status=${status}`)
      return
    }

    const note = data.data
    lastStatus = note.aiStatus
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    info(`  [${elapsed}s] aiStatus=${note.aiStatus}`)

    if (note.aiStatus === "done") {
      // Check all AI fields
      if (note.embedding?.length > 0) {
        pass(`Note has embedding (${note.embedding.length} dims)`)
      } else {
        fail("Embedding", "aiStatus=done but embedding is empty")
      }

      if (Array.isArray(note.tags) && note.tags.length > 0) {
        pass(`Note has tags: [${note.tags.join(", ")}]`)
      } else {
        fail("Tags", "aiStatus=done but tags are empty")
      }

      if (typeof note.aiFeedback === "string" && note.aiFeedback.length > 0) {
        pass(`Note has feedback: "${note.aiFeedback.slice(0, 60)}..."`)
      } else {
        fail("Feedback", "aiStatus=done but aiFeedback is empty")
      }

      return
    }

    if (note.aiStatus === "failed") {
      fail("AI processing", "aiStatus=failed — check server logs")
      return
    }

    if (note.aiStatus === "quota_exceeded") {
      fail("AI processing", "aiStatus=quota_exceeded — user hit limit")
      return
    }

    await sleep(POLL_INTERVAL_MS)
  }

  fail("AI processing", `timed out after ${WAIT_FOR_AI_MS}ms (last status: ${lastStatus})`)
}

async function testFeedbackEndpoint() {
  section("AI: POST /feedback")

  const { status, data } = await http("POST", `/api/ai/notes/${state.noteId}/feedback`, {
    token: state.token,
  })

  if (status === 200 && typeof data?.feedback === "string" && data.feedback.length > 0) {
    pass(`POST /feedback → ${data.feedback.slice(0, 80)}...`)
  } else {
    fail("POST /feedback", `status=${status}, body=${JSON.stringify(data).slice(0, 200)}`)
  }
}

async function testFeedbackWrongUser() {
  section("AI: POST /feedback with wrong user (should 404)")

  // Register a second user
  const u2 = `attacker_${Date.now()}`
  await http("POST", "/api/auth/register", {
    body: { username: u2, email: `${u2}@test.com`, password: "password123" },
  })
  const loginRes = await http("POST", "/api/auth/login", {
    body: { username: u2, password: "password123" },
  })
  const token2 = loginRes.data?.data?.token

  if (!token2) {
    fail("Second user login", "could not get token")
    return
  }

  const { status } = await http("POST", `/api/ai/notes/${state.noteId}/feedback`, {
    token: token2,
  })

  if (status === 404) {
    pass("Wrong user → 404 (correctly hidden)")
  } else {
    fail("Wrong user", `expected 404, got ${status}`)
  }
}

async function testInvalidNoteId() {
  section("AI: Invalid note ID (should 400)")

  const { status } = await http("POST", `/api/ai/notes/not-a-valid-id/feedback`, {
    token: state.token,
  })

  if (status === 400) {
    pass("Invalid ObjectId → 400")
  } else {
    fail("Invalid ID", `expected 400, got ${status}`)
  }
}

async function testChatStream() {
  section("AI: POST /chat (SSE stream)")

  const res = await fetch(`${BASE_URL}/api/ai/notes/${state.noteId}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.token}`,
    },
    body: JSON.stringify({ message: "Can you give one concrete example?" }),
  })

  if (res.status !== 200) {
    fail("POST /chat", `status=${res.status}`)
    return
  }

  const contentType = res.headers.get("content-type") || ""
  if (!contentType.includes("text/event-stream")) {
    fail("Content-Type", `expected text/event-stream, got ${contentType}`)
    return
  }
  pass("Response Content-Type is text/event-stream")

  // Read the stream
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let chunks = 0
  let fullText = ""
  let sawDone = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() // keep incomplete last line

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const payload = line.slice(6).trim()
      if (!payload) continue

      try {
        const parsed = JSON.parse(payload)
        if (parsed.chunk) {
          chunks++
          fullText += parsed.chunk
        }
        if (parsed.done) sawDone = true
        if (parsed.error) {
          fail("Stream error event", parsed.error)
          return
        }
      } catch {
        // ignore non-JSON lines
      }
    }
  }

  if (chunks > 0) {
    pass(`Received ${chunks} chunks, total length=${fullText.length}`)
    info(`     "${fullText.slice(0, 100)}..."`)
  } else {
    fail("Streaming", "no chunks received")
  }

  if (sawDone) {
    pass("Received { done: true } signal")
  } else {
    fail("Stream completion", "never saw { done: true }")
  }
}

async function testChatEmptyMessage() {
  section("AI: POST /chat with empty message (should 400)")

  const { status } = await http("POST", `/api/ai/notes/${state.noteId}/chat`, {
    token: state.token,
    body: { message: "" },
  })

  if (status === 400) {
    pass("Empty message → 400")
  } else {
    fail("Empty message", `expected 400, got ${status}`)
  }
}

async function testChatHistory() {
  section("AI: GET /chat (history)")

  const { status, data } = await http("GET", `/api/ai/notes/${state.noteId}/chat`, {
    token: state.token,
  })

  if (status !== 200 || !Array.isArray(data?.messages)) {
    fail("GET /chat", `status=${status}, body=${JSON.stringify(data).slice(0, 200)}`)
    return
  }

  const msgs = data.messages
  pass(`GET /chat → ${msgs.length} messages`)

  // Expected: assistant (feedback), user (chat), assistant (reply)
  if (msgs.length >= 3) {
    pass(`History has ${msgs.length} messages (expected ≥3)`)
  } else {
    fail("History length", `expected ≥3, got ${msgs.length}`)
  }

  // Check roles
  const roles = msgs.map((m) => m.role)
  info(`     roles: ${roles.join(" → ")}`)

  // Check chronological order
  let ordered = true
  for (let i = 1; i < msgs.length; i++) {
    if (new Date(msgs[i].createdAt) < new Date(msgs[i - 1].createdAt)) {
      ordered = false
    }
  }
  if (ordered) {
    pass("Messages are chronological")
  } else {
    fail("Order", "messages are not sorted by createdAt")
  }
}

// ─── Main ─────────────────────────────────────────────────
async function main() {
  console.log(c.bold(`\n🧪 MindWeave E2E Test Suite`))
  console.log(c.dim(`Target: ${BASE_URL}\n`))

  try {
    await testHealth()
    await testRegister()
    await testLogin()

    if (!state.token) {
      console.log(c.red("\n❌ Cannot continue without auth token. Aborting.\n"))
      process.exit(1)
    }

    await testCreateNote()
    await testGetNoteUnauthed()
    await testWaitForAI()
    await testFeedbackEndpoint()
    await testFeedbackWrongUser()
    await testInvalidNoteId()
    await testChatStream()
    await testChatEmptyMessage()
    await testChatHistory()
  } catch (err) {
    console.log(c.red(`\n💥 Unexpected error: ${err.message}`))
    console.log(c.dim(err.stack))
  }

  // Summary
  console.log(c.bold(`\n━━━ Summary ━━━`))
  console.log(`  ${c.green(`Passed: ${passed}`)}`)
  console.log(`  ${failed > 0 ? c.red(`Failed: ${failed}`) : c.dim(`Failed: 0`)}`)
  console.log()

  process.exit(failed > 0 ? 1 : 0)
}

main()
