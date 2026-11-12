function sleep (ms){
    return new Promise(resolve => setTimeout(resolve, ms))
}

export class AiOrchestrator {
    constructor (adapter, fallbackAdapter=null){
        this.adapter = adapter
        this.fallback = fallbackAdapter
        this.failures = 0  
        this.lastFailure = 0
    }

    async embed (text){
        return this._execute(()=> this.adapter.embed(text))
    }

    async generateFeedback (title, content){
        return this._execute(() => this.adapter.generateFeedback (title, content))
    }

    async generateTags( title, content ){
        return this._execute(() => this.adapter.chat( title, content ))
    }

    async chat (message, onChunk){
        return this._execute(() => this.adapter.chat( message, onChunk ))
    }

     async _execute (fn) {
        if (this.failures >= 3 && Date.now() - this.lastFailure < 60000) {
            if (this.fallback) return fn.call (this.fallback)
            throw new Error ("AI circuit open")
        }

        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const result = await this._withTimeout (fn(), 10000)
                this.failures = 0
                return result
            }
            catch (err){
                
                    console.log("━━━ Orchestrator caught error ━━━")
                    console.log("Message:", err.message)
                    console.log("Attempt:", attempt + 1)
                    // ... rest unchanged
                  
                if (err.message?.startsWith("RATE_LIMITED:")){
                    const sec = parseInt (err.message.split(":")[1])
                    await sleep (sec * 1000)
                    continue
                }

                this.failures++
                this.lastFailure = Date.now()

                if (attempt < 2){
                    await sleep (2000 * Math.pow(2, attempt))
                }
            }
        }
        throw new Error ("AI failed after 3 attempts")
    }

    _withTimeout (promise, ms){
        return Promise.race([
            promise,
            new Promise ((_, reject)=>
            setTimeout(() => reject(new Error("AI_TIMEOUT")), ms))
        ])
    }
}
