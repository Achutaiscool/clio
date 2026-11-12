import { z } from "zod"

const feedbackSchema = z.object ({
    critique: z.string(),
    suggestions: z.array(z.string()).optional().default([]) 
})

function truncateSmart (text, maxlen=2000){
    if (text.length <= maxlen) return text

    const truncated = text.slice(0, maxlen)
    const lastSentenceEnd = Math.max(
        truncated.lastIndexOf( '. ' ),
        truncated.lastIndexOf( '! ' ),
        truncated.lastIndexOf( '? ' )
    )

    if (lastSentenceEnd > maxlen * 0.8){
        return truncated.slice(0, lastSentenceEnd + 1)
    }

    const lastSpace = truncated.lastIndexOf(" ")
    if (lastSpace > maxlen * 0.5){
        return truncated.slice (0, lastSpace) + "..."
    }

    return truncated.slice(0, maxlen - 3) + '...'
}


export function normalizeFeedback( rawText ){
    let cleaned = rawText
        .replace(/```json\s*/gi,"")
        .replace(/```\s*/gi, "")
        .trim()
   
    const jsonMatch = cleaned.match(/\{[\s\S]*?\}/)
    if (jsonMatch) cleaned = jsonMatch[0]

    try{
        const parsed = JSON.parse( cleaned )
        return feedbackSchema.parse( parsed )
    }
    
    catch{
        return {
            critique: truncateSmart( cleaned,2000 ),
            suggestions:[],
        }
    }
}
