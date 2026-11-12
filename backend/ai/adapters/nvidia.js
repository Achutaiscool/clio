import OpenAI from 'openai'
import 'dotenv/config'
import { AiPort } from '../port'
import { normalizeFeedback } from '../normalizer.js'

const nvidia = new OpenAI({
  apiKey: '$NVIDIA_API_KEY',
  baseURL: 'https://integrate.api.nvidia.com/v1'
})

export class nvidiaAdapter extends AiPort {
  async embed (text){
    
  }
}
