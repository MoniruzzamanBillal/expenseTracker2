import httpStatus from "http-status";
import OpenAI from "openai";
import AppError from "../Error/AppError";
import config from "../config";

export type TChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type TAskOptions = {
  jsonMode?: boolean;
  temperature?: number;
};

const openRouterClient = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: config.openRouterApiKey,
  timeout: 20_000,
  maxRetries: 0,
  defaultHeaders: {
    // ! placeholder — swap for the deployed server URL once one is settled on
    "HTTP-Referer": "https://expensetracker-server.vercel.app",
    "X-Title": "Expense Tracker",
  },
});

// ! free models to try in order - if one is rate limited/down, fall back to the next
// ! verified live against OpenRouter's /models catalog on 2026-09-03 — the previous
// ! list (nemotron-3-nano-30b, llama-3.2-3b, qwen3-next-80b) had all three retired
// ! from the free tier by OpenRouter; re-verify here before trusting this list long-term
const FREE_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "minimax/minimax-m2.7:free",
  "google/gemma-4-26b-a4b-it:free",
];

// ! single choke point every ai feature talks through
export const askOpenRouter = async (
  messages: TChatMessage[],
  options?: TAskOptions,
): Promise<string> => {
  let lastError: unknown;

  for (const model of FREE_MODELS) {
    try {
      const response = await openRouterClient.chat.completions.create({
        model,
        messages,
        temperature: options?.temperature ?? 0.7,
        ...(options?.jsonMode
          ? { response_format: { type: "json_object" as const } }
          : {}),
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error("Empty response from model");
      }

      return content;
    } catch (error) {
      lastError = error;
      continue;
    }
  }

  console.error("openRouterClient: all free models failed", lastError);

  throw new AppError(
    httpStatus.SERVICE_UNAVAILABLE,
    "AI service is busy right now, please try again shortly",
  );
};
