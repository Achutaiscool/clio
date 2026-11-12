import { AiPort } from "../port.js"
import { normalizeFeedback } from "../normalizer.js"

const API_URL = "https://openrouter.ai/api/v1"
const KEY = process.env.OPENROUTER_API_KEY

export class OpenRouterAdapter extends AiPort {
    async embed(text) {
  const res = await fetch(`${API_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "http://localhost:5000",
      "X-Title": "MindWeave",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: text.slice(0, 8000),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Embed failed: ${res.status} ${err.error?.message || ""}`)
  }

  const data = await res.json()
  return data.data[0].embedding
}
    async generateFeedback (title, content) {
        const raw = await this._chat (
           `You are a helpful writing assistant.
            Give 2-3 sentences of constructive feedback on this note.
            What's good, what's unclear, and one specific suggestion.
             
            Return ONLY a JSON object with a "critique" string field.

            Title: "${title}"
            Content: "${content.slice(0, 3000)}"`,
            "google/gemma-4-31b-it:free"
        )
        const normalized = normalizeFeedback (raw)
        return normalized.critique
    }

    async generateTags (title, content){
        const raw = await this._chat(
            `Return 3-5 single word tags as a comma-separated list. 
            No explaination.
            
            Title: "${title}"
            Content: "${content.slice(0, 1000)}"`,
            "google/gemma-4-31b-it:free"
        )

        return raw
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t.length > 0)
    }

    async chat (messages, onChunk){
        const res = await fetch( `${API_URL}/chat/completions`,{
            method: "POST",
            headers: {
                Authorization: `Bearer ${KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": process.env.APP_URL || "http://localhost:5000",
                "X-Title": "MindWeave",
            },
            body:JSON.stringify({
                model: "google/gemma-4-31b-it:free",
                messages,
                temperature: 0.7,
                stream: true
            }),
        })

        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.error?.message || `OpenRouter ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true})
            const lines = chunk.split("\n")

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue
                const data = line.slice(6)



                try{
                    const parsed = JSON.parse(data)
                    const content = parsed.choices?.[0]?.delta?.content
                    if (content) onChunk(content)
                } 
                
                catch{

                }
            }
        }
    }

    async _chat (prompt, model){
        const res = await fetch(`${API_URL}/chat/completions`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": process.env.APP_URL || "http://localhost:5000",
                "X-Title": "MindWeave",
            },
            body: JSON.stringify({
                model,
                messages: [{ role:"user", content:prompt }],
                temperature: 0.7,
                max_tokens: 500,
            }),
        })
        if (res.status === 429) {
            const retryAfter = parseInt(res.headers.get("retry-after") || "60")
            throw new Error(`RATE_LIMITED: ${retryAfter}`)
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(`OpenRouter ${res.status}: ${err.error?.message || "unknown"}`)
        }
        const data = await res.json()
        return data.choices[0].message.content
    }

} 
