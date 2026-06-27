import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const baseURL = process.env.ROUTER_BASE_URL ?? "http://localhost:3000/v1";
const apiKey = process.env.ROUTER_API_KEY ?? "dev";

const llm = new ChatOpenAI({
  model: "auto",
  apiKey,
  configuration: { baseURL },
  temperature: 0.2,
  maxRetries: 0,
});

const main = async (): Promise<void> => {
  console.log(`Calling ${baseURL} with model "auto"...`);
  try {
    const response = await llm.invoke([
      new SystemMessage("You are a senior backend engineer. Reply with code only."),
      new HumanMessage("Write a TypeScript function add(a: number, b: number) that returns a + b."),
    ]);
    console.log("---");
    console.log(response.content);
    console.log("---");
    console.log("Model used (visible to LangChain):", response.response_metadata?.model_name ?? "n/a");
  } catch (err) {
    const e = err as { status?: number; error?: { message?: string; type?: string }; message?: string };
    console.error("LangChain call failed:");
    console.error("  status :", e.status ?? "n/a");
    console.error("  type   :", e.error?.type ?? "n/a");
    console.error("  message:", e.error?.message ?? e.message);
    process.exit(1);
  }
};

await main();
