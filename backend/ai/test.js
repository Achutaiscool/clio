import { AiPort } from "./port"
import { normalizeFeedBack } from "./normalizer"

export class OpenRouterAdp extends AiPort{
  async embed(text){
    const res = await fetch(
      `https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2`,
    {
    method: "POST",
    headers:{
          "Authorization": `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json"
        },

    body: JSON.stringify({input:text})
    })
    }
    if(!res.ok) throw Error(`embeding failed `)
    return res.json()
  }

  async generateFeedback(title,content){
    const raw = `you are MindWeave a helpful Ai agent in a notes app, you are suppsed to give constructive 
                  feedback to the user,in no more than 3-5 sentences return in json format
                  Title:${title}
                  Content:${content}`
    const res = await fetch{
      'https://openrouter.ai/api/v1/chat/completions',{
        method: 'POST',
        headers:{
          Authorization: `Bearer ${process.env.API_KEY}`,
          'Content-Type':'applicaiton/json',
        },
        body: JSON.stringify({
          model: 'openai/o4-mini',
          input: raw,
        })
      }
    }
    return res
  }

  async generateTag(title,content){
    const raw =`give 3-5 tags based on the notes you see,in comma separated lists
              title:${title}
              content:${content}`
    const res =  await fetch{
      'https://openrouter.ai/api/v1/chat/completions',{
        method: 'POST',
        headers:{
          Authorization: `Bearer ${process.env.API_KEY}`,
          'Content-Type':'applicaiton/json',
        },
        body: JSON.stringify({
          model: 'openai/o4-mini',
          input: raw,
        })
      }
    return res

  }
}
