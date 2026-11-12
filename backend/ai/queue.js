import Note from "../models/Note.js"
import Usage from "../models/Usage.js"

const jobs = []
let processing = false


export function enqueueAIJob ( noteId, title, content, userId ) {
    jobs.push ({ noteId, title, content, userId, attempts: 0})
    if(!processing) processQueue()
}

async function processQueue() {
    if (jobs.length === 0){
        processing = false
        return
    }

    processing = true
    const job = jobs.shift()

    try {
        const { orchestrator } = await import( "./index.js" )

        const month = new Date().toISOString().slice(0, 7)
        const limit = parseInt( process.env.FREE_TIER_LIMIT || "50" )

        const usage = await Usage.findOneAndUpdate(
            { userId: job.userId, month },
            { $inc: { aiCalls:1 } },
            { upsert: true, new:true }
        )

        if ( usage.aiCalls >limit ){
            await Note.findByIdAndUpdate( job.noteId, { aiStatus: "quota_exceeded"})

            processQueue()
            return
        }

        const [ embedding, tags, feedback ] = await Promise.all([
            orchestrator.embed(`${job.title}\n ${job.content}`),
            orchestrator.generateTags ( job.title, job.content ),
            orchestrator.generateFeedback( job.title, job.content )
        ])

        await Note.findByIdAndUpdate( job.noteId, {
            embedding,
            tags,
            aiFeedback: feedback,
            aiStatus: "done",
            aiProcessedAt: new Date(),
        } )
    } 

    catch( err ){
        console.error( " AI job failed : ", err.message)

        if(job.attempts < 3){
            jobs.unshift( { ...job, attempts: job.attempts +1})

            await sleep(5000)
        }

        else{
            await Note.findByIdAndUpdate (job.noteId, {
                aiStatus: "failed",
                aiError: err.message
            })
        }
    }

    await sleep(3000)
    processQueue()
}
function sleep(ms){
    return new Promise ((r) => setTimeout( r, ms ))
}
