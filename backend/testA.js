// test-adapter.js
import "dotenv/config"
import { OpenRouterAdapter } from "./ai/adapters/openrouter.js"

// ─── Colors ───────────────────────────────────────────────
const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
}

function section(title) {
  console.log(`\n${c.cyan(c.bold(`━━━ ${title} ━━━`))}`)
}

function ok(msg) {
  console.log(`  ${c.green("✅")} ${msg}`)
}

function fail(msg, err) {
  console.log(`  ${c.red("❌")} ${msg}`)
  if (err) {
    console.log(`     ${c.dim(err.message)}`)
    if (err.stack) {
      const line = err.stack.split("\n").find((l) => l.includes("openrouter.js"))
      if (line) console.log(`     ${c.dim(line.trim())}`)
    }
  }
}

// ─── Verify env loaded ────────────────────────────────────
console.log(c.bold("\n🔍 Environment Check"))
const key = process.env.OPENROUTER_API_KEY || ""
console.log(`  KEY length: ${key.length}`)
console.log(`  KEY prefix: ${key.slice(0, 12)}`)
console.log(`  APP_URL:    ${process.env.APP_URL || "(not set)"}`)

if (!key || key.length < 40) {
  console.log(c.red("\n❌ OPENROUTER_API_KEY looks invalid. Fix .env before running.\n"))
  process.exit(1)
}

const adapter = new OpenRouterAdapter()

// ─── Tests ────────────────────────────────────────────────
async function testEmbed() {
  section("embed(text)")
  const start = Date.now()
  try {
    const vector = await adapter.embed("Machine learning transforms healthcare.")
    const ms = Date.now() - start
    if (Array.isArray(vector) && vector.length > 0) {
      ok(`Returned ${vector.length}-dim vector in ${ms}ms`)
      console.log(`     ${c.dim(`First 3 values: [${vector.slice(0, 3).map((v) => v.toFixed(4)).join(", ")}]`)}`)
    } else {
      fail("Not an array or empty")
    }
  } catch (err) {
    fail("embed() failed", err)
  }
}

async function testGenerateFeedback() {
  section("generateFeedback(title, content)")
  const start = Date.now()
  try {
    const feedback = await adapter.generateFeedback(
      "Machine Learning in Healthcare",
      "Machine learning is transforming healthcare through predictive diagnostics, personalized treatments, and early disease detection."
    )
    const ms = Date.now() - start
    if (typeof feedback === "string" && feedback.length > 0) {
      ok(`Returned ${feedback.length}-char string in ${ms}ms`)
      console.log(`     ${c.dim(`"${feedback.slice(0, 100)}..."`)}`)
    } else {
      fail("Not a non-empty string")
    }
  } catch (err) {
    fail("generateFeedback() failed", err)
  }
}

async function testGenerateTags() {
  section("generateTags(title, content)")
  const start = Date.now()
  try {
    const tags = await adapter.generateTags(
      "Machine Learning in Healthcare",
      "Neural networks, predictive diagnostics, personalized medicine."
    )
    const ms = Date.now() - start
    if (Array.isArray(tags) && tags.length > 0) {
      ok(`Returned ${tags.length} tags in ${ms}ms`)
      console.log(`     ${c.dim(`[${tags.join(", ")}]`)}`)
    } else {
      fail("Not a non-empty array")
    }
  } catch (err) {
    fail("generateTags() failed", err)
  }
}

async function testChat() {
  section("chat(messages, onChunk)")
  const start = Date.now()
  try {
    const messages = [
      { role: "system", content: "You are a concise assistant." },
      { role: "user", content: "Say hello in exactly 5 words." },
    ]

    let chunkCount = 0
    let fullText = ""

    await adapter.chat(messages, (chunk) => {
      chunkCount++
      fullText += chunk
    })

    const ms = Date.now() - start
    if (chunkCount > 0 && fullText.length > 0) {
      ok(`Streamed ${chunkCount} chunks (${fullText.length} chars) in ${ms}ms`)
      console.log(`     ${c.dim(`"${fullText.slice(0, 100)}"`)}`)
    } else {
      fail("No chunks received")
    }
  } catch (err) {
    fail("chat() failed", err)
  }
}

// ─── Main ─────────────────────────────────────────────────
async function main() {
  console.log(c.bold("\n🧪 Testing OpenRouter Adapter\n"))

  await testEmbed()
  await testGenerateFeedback()
  await testGenerateTags()
  await testChat()

  console.log(c.bold("\n━━━ Done ━━━\n"))
  process.exit(0)
}

main()
