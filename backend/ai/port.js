export class AiPort{
    async embed( text ){
        throw new Error( "embed() not implemented" )
    }

    async generateFeedback (title, content){
        throw new Error ("generateFeedBack() not implemented")
    }

    async chat(messages, onChunk){
        throw new Error("chat() not implemented")
    }

    async generateTags( title, content){
        throw new Error( "generateTags() not implemented")
    }
}
