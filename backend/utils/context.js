import Message from "../models/Messages.js"

const SYSTEM_PROMPT = `You are MindWeave an insightful AI assistant embedded in a note a note taking app.
You help refine thier ideas , ask clarifying questions, and suggest connections to other notes.
Be consise constructive and never hallucinate content not present in the user's notes`

const MAX_HISTROY_TOKENS_ESTIMATE = 4000
const MAX_NOTES_CHAR = 3000

/**
 *build a chat messages array for the LLM
 *@param {string} noteId
 *@param {string} noteContent
 *@param {object} options
 *@param {number} options.maxHistroyChars
 *@returns {Promise<Array<{role:string, content:string}>>}
*/

export async function buildChatContext (noteId, noteContent, options = {}){
  const maxHistroyChars = options.maxHistroyChars ?? MAX_HISTROY_TOKENS_ESTIMATE

  const messages = [{ role: "system", content: SYSTEM_PROMPT}]

  const truncateNote = 
    noteContent.length > MAX_NOTES_CHAR ? noteContent.slice (0, MAX_NOTES_CHAR) + "\n... [truncated]": noteContent

  messages.push({
    role: "system",
    content: `The user is viewing the current note:\n ${truncateNote}--\n`
  })
  
  const history = Message.find({noteId})
  .sort({ createdAt: 1})
  .lean()
  
  let historyChars = 0
  const historyMessages = []
  
 for (let i = history.length -1; i>=0; i--){
    const m = history[i]
    const entry = { role: m.role, content: m.content}
    const entryChars = JSON.stringify(entry).length

    if (historyChars + entryChars > maxHistroyChars) break
    
    historyMessages.unshift(entry)
    historyChars += entryChars
  }

  messages.push(...historyMessages)
  return messages
}


