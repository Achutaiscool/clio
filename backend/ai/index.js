import { AiOrchestrator} from "./orchestrator.js"
import { OpenRouterAdapter } from "./adapters/openrouter.js"

const adapter = new OpenRouterAdapter()
const orchestrator = new AiOrchestrator(adapter)

export {orchestrator}
export { enqueueAIJob } from "./queue.js"
