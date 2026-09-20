// The Cut chat agent's hosted GPT option. Mirrors gemini-responses.ts's shape
// (createResponse/createResponseStream, the same normalized {output_text,
// output, usage} body) but talks to OpenAI's own Responses API, which the
// wire format was already modeled on — tool declarations
// ({type:"function", name, description, parameters}) pass through almost
// verbatim. The one real translation is content-item shape: DepCut's wire
// input nests functionCall/function_response inside a role's content array
// (Gemini's shape); OpenAI's Responses API wants those as flat top-level
// items (function_call/function_call_output) alongside message items.
import OpenAI, { APIError } from "openai";
import type {
  ResponseCreateParamsNonStreaming,
  ResponseCreateParamsStreaming,
  ResponseInputItem,
  ResponseStreamEvent as OpenAIResponseStreamEvent,
  Tool as OpenAITool,
} from "openai/resources/responses/responses";

import { isJsonObject, toJsonValue } from "@/lib/inference/json";
import {
  InferenceProviderError,
  type InferenceModality,
  type InferenceModel,
  type InferenceProvider,
  type JsonObject,
  type JsonValue,
  type ResponseCreateRequest,
  type ResponseCreateResult,
  type ResponseStreamEvent,
  type ResponseStreamResult,
} from "@/lib/inference/providers";
import { openaiModels } from "@/lib/inference/openai-models";

type AdapterEnvironment = Record<string, string | undefined>;

const providerID = "openai-chat-responses";
const openAIProviderID = "openai";
const openAIBaseURL = "https://api.openai.com/v1";
const defaultModel = openaiModels.chat;

export function createOpenAIChatResponsesProvider(
  environment: AdapterEnvironment = process.env,
): InferenceProvider {
  const apiKey = environment.OPENAI_API_KEY?.trim() ?? "";
  const configured = apiKey.length > 0;
  const client = () => new OpenAI({ apiKey, baseURL: openAIBaseURL });

  async function listModels(modalities: InferenceModality[]) {
    const requested = modalities.length > 0 ? modalities : ["text"];
    if (!requested.includes("text") || !apiKey) {
      return [];
    }
    return [staticModel(defaultModel)];
  }

  function requestParameters(request: ResponseCreateRequest) {
    const model = requestedModel(request.body, defaultModel);
    const input = openAIInput(request.body.input);
    const tools = openAITools(request.body.tools);
    const instructions = stringValue(request.body.instructions);
    return {
      model,
      input,
      ...(instructions ? { instructions } : {}),
      ...(tools.length > 0 ? { tools } : {}),
    };
  }

  async function createResponse(
    request: ResponseCreateRequest,
  ): Promise<ResponseCreateResult> {
    ensureConfigured(configured);
    const params = requestParameters(request);
    try {
      const response = await client().responses.create(
        params as ResponseCreateParamsNonStreaming,
      );
      const body = normalizedOpenAIResponse(toJsonValue(response));
      return {
        provider: openAIProviderID,
        model: params.model,
        body,
        usage: isJsonObject(body) ? body.usage : undefined,
        metadata: { provider: openAIProviderID, api: "responses" },
      };
    } catch (error) {
      throw openAIProviderError(error);
    }
  }

  async function createResponseStream(
    request: ResponseCreateRequest,
  ): Promise<ResponseStreamResult> {
    ensureConfigured(configured);
    const params = requestParameters(request);
    let stream: AsyncIterable<OpenAIResponseStreamEvent>;
    try {
      stream = await client().responses.create(
        { ...params, stream: true } as ResponseCreateParamsStreaming,
      );
    } catch (error) {
      throw openAIProviderError(error);
    }
    return {
      provider: openAIProviderID,
      model: params.model,
      events: responseStreamEvents(stream),
      metadata: { provider: openAIProviderID, api: "responses" },
    };
  }

  return {
    id: providerID,
    configured,
    capabilities: ["text", "image"],
    responseProviderIDs: [openAIProviderID],
    // The narrow debug-inspection adapter (hosted-responses.ts) claims that
    // one tool's requests via its own canCreateResponse; everything else —
    // every normal chat/tool-calling request — belongs here.
    canCreateResponse: () => true,
    handlesResponseMedia: (request) => !hasUnsupportedMediaPart(request.body.input),
    listModels,
    createResponse,
    createResponseStream,
  };
}

// OpenAI's Responses API hands back one terminal `response.completed` event
// carrying the fully aggregated response — unlike Gemini's stream, there is
// no manual part-accumulation to do. Forward text deltas live for the UI,
// then normalize that one terminal snapshot into the shared body shape.
async function* responseStreamEvents(
  stream: AsyncIterable<OpenAIResponseStreamEvent>,
): AsyncGenerator<ResponseStreamEvent> {
  for await (const event of stream) {
    if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
      yield { type: "output_text_delta", delta: event.delta };
    } else if (event.type === "response.completed") {
      const body = normalizedOpenAIResponse(toJsonValue(event.response));
      yield { type: "completed", body, usage: isJsonObject(body) ? body.usage : undefined };
      return;
    } else if (event.type === "error") {
      throw new InferenceProviderError(
        stringValue((event as { message?: unknown }).message) ?? "OpenAI stream failed.",
      );
    }
  }
}

// The wire body's own Responses-shaped output (see gemini-responses.ts's
// normalizedGeminiResponse) — output_text plus a message item and one
// function_call item per tool call, arguments as a plain object (OpenAI's
// own `arguments` is a JSON string; every other provider's wire shape here
// carries it parsed).
function normalizedOpenAIResponse(raw: JsonValue): JsonObject {
  const output = isJsonObject(raw) && Array.isArray(raw.output) ? raw.output : [];
  const textParts: string[] = [];
  const calls: JsonObject[] = [];
  for (const item of output) {
    if (!isJsonObject(item)) continue;
    if (item.type === "message" && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (isJsonObject(part) && part.type === "output_text") {
          const text = stringValue(part.text);
          if (text) textParts.push(text);
        }
      }
    } else if (item.type === "function_call") {
      const rawArguments = stringValue(item.arguments);
      let parsedArguments: JsonObject = {};
      if (rawArguments) {
        try {
          const parsed = JSON.parse(rawArguments) as JsonValue;
          if (isJsonObject(parsed)) parsedArguments = parsed;
        } catch {
          // Malformed tool-call JSON from the model: run it with no
          // arguments rather than fail the whole turn.
        }
      }
      calls.push({
        id: stringValue(item.call_id) ?? stringValue(item.id) ?? `call-${Math.random().toString(36).slice(2)}`,
        name: stringValue(item.name) ?? "unknown_function",
        arguments: parsedArguments,
      });
    }
  }

  const outputText = stringValue(isJsonObject(raw) ? raw.output_text : undefined) ?? textParts.join("\n").trim();
  return {
    id: stringValue(isJsonObject(raw) ? raw.id : undefined) ?? `openai-${Date.now()}`,
    object: "response",
    output_text: outputText,
    output: [
      { type: "message", role: "assistant", content: textParts.map((text) => ({ type: "output_text", text })) },
      ...calls.map((call) => ({ type: "function_call", ...call })),
    ],
    provider_output: raw,
    usage: isJsonObject(raw) ? raw.usage ?? null : null,
  };
}

function openAITools(rawTools: JsonValue | undefined): OpenAITool[] {
  if (!Array.isArray(rawTools)) return [];
  const tools: OpenAITool[] = [];
  for (const tool of rawTools) {
    if (!isJsonObject(tool) || tool.type !== "function") continue;
    const name = stringValue(tool.name);
    if (!name) continue;
    tools.push({
      type: "function",
      name,
      description: stringValue(tool.description) ?? null,
      parameters: isJsonObject(tool.parameters) ? (tool.parameters as Record<string, unknown>) : {},
      strict: false,
    } as OpenAITool);
  }
  return tools;
}

// Wire input items → OpenAI's flat Responses input array: text/image content
// stays grouped under its role's message, while a functionCall/
// function_response content part (nested in DepCut's Gemini-flavored wire
// shape) becomes its own top-level function_call/function_call_output item —
// the shape the Responses API actually expects them in.
function openAIInput(input: JsonValue | undefined): ResponseInputItem[] {
  if (typeof input === "string") {
    return [{ role: "user", content: [{ type: "input_text", text: input }] }];
  }
  if (!Array.isArray(input)) return [];

  const items: ResponseInputItem[] = [];
  let bufferRole: "user" | "assistant" | null = null;
  let buffer: ResponseInputItem.Message["content"] = [];
  const flush = () => {
    if (bufferRole && buffer.length > 0) {
      items.push({ role: bufferRole, content: buffer } as ResponseInputItem);
    }
    bufferRole = null;
    buffer = [];
  };

  for (const rawItem of input) {
    if (!isJsonObject(rawItem)) continue;
    const role = stringValue(rawItem.role) === "assistant" ? "assistant" : "user";
    const parts = Array.isArray(rawItem.content) ? rawItem.content : [rawItem.content];
    for (const part of parts) {
      if (!isJsonObject(part)) {
        if (typeof part === "string" && part) {
          if (bufferRole !== role) flush();
          bufferRole = role;
          buffer.push(textContent(role, part));
        }
        continue;
      }
      const functionCall = isJsonObject(part.functionCall)
        ? part.functionCall
        : isJsonObject(part.function_call)
          ? part.function_call
          : null;
      if (functionCall) {
        flush();
        items.push({
          type: "function_call",
          call_id: stringValue(functionCall.id) ?? "",
          name: stringValue(functionCall.name) ?? "unknown_function",
          arguments: JSON.stringify(functionCall.args ?? {}),
        } as ResponseInputItem);
        continue;
      }
      const functionResponse = isJsonObject(part.functionResponse)
        ? part.functionResponse
        : part.type === "function_response"
          ? part
          : null;
      if (functionResponse) {
        flush();
        items.push({
          type: "function_call_output",
          call_id: stringValue(functionResponse.id) ?? "",
          output: JSON.stringify(functionResponse.response ?? null),
        } as ResponseInputItem);
        continue;
      }
      if (part.type === "input_image" || part.type === "image") {
        if (bufferRole !== "user") flush();
        bufferRole = "user";
        const image = imageContent(part);
        if (image) buffer.push(image);
        continue;
      }
      if (part.type === "input_audio" || part.type === "audio" || part.type === "input_video" || part.type === "video") {
        // Neither GPT-5.5 (Responses API text) nor Claude accept raw
        // audio/video input — degrade to a text note rather than dropping
        // the turn (handlesResponseMedia already steers the router away
        // from this adapter when the request carries media it can't take,
        // but a defensive fallback here costs nothing).
        if (bufferRole !== role) flush();
        bufferRole = role;
        buffer.push(textContent(role, "[unsupported media part: audio/video input]"));
        continue;
      }
      const text = stringValue(part.text);
      if (text) {
        if (bufferRole !== role) flush();
        bufferRole = role;
        buffer.push(textContent(role, text));
      }
    }
  }
  flush();
  return items;
}

function textContent(role: "user" | "assistant", text: string) {
  return { type: role === "assistant" ? "output_text" : "input_text", text } as ResponseInputItem.Message["content"][number];
}

function imageContent(part: JsonObject): ResponseInputItem.Message["content"][number] | null {
  const mimeType = stringValue(part.mimeType) || stringValue(part.mime_type) || "image/png";
  const base64 = stringValue(part.dataBase64) || stringValue(part.data_base64);
  if (base64) {
    return { type: "input_image", image_url: `data:${mimeType};base64,${base64}`, detail: "auto" };
  }
  const url = stringValue(part.url) || stringValue(part.image_url);
  if (url) {
    return { type: "input_image", image_url: url, detail: "auto" };
  }
  return null;
}

function hasUnsupportedMediaPart(input: JsonValue | undefined): boolean {
  if (!Array.isArray(input)) return false;
  return input.some((item) => {
    if (!isJsonObject(item)) return false;
    const parts = Array.isArray(item.content) ? item.content : [item.content];
    return parts.some(
      (p) =>
        isJsonObject(p) &&
        (p.type === "input_audio" || p.type === "audio" || p.type === "input_video" || p.type === "video"),
    );
  });
}

// The Cut chat agent's model picker suffixes the hosted catalog entry
// ("gpt-5.5-hosted") to keep it from colliding with the same id under the
// local-CLI "codex" provider group (see aiModels.ts) — strip it back to the
// real Responses API model string before calling OpenAI.
function requestedModel(body: JsonObject, fallback: string) {
  const model = body.model;
  if (typeof model !== "string" || !model.trim()) return fallback;
  return model.endsWith("-hosted") ? model.slice(0, -"-hosted".length) : model;
}

function ensureConfigured(configured: boolean) {
  if (!configured) {
    throw new InferenceProviderError("OpenAI is not configured on this deployment.", {
      statusCode: 503,
      code: "missing_provider_credentials",
    });
  }
}

function staticModel(model: string): InferenceModel {
  return {
    id: model,
    name: model,
    provider: openAIProviderID,
    inputModalities: ["text", "image"],
    outputModalities: ["text"],
    contextLength: null,
    pricing: null,
    metadata: { provider: openAIProviderID, api: "responses" },
  };
}

function stringValue(value: JsonValue | unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function openAIProviderError(error: unknown) {
  if (error instanceof APIError) {
    return new InferenceProviderError("OpenAI request failed.", {
      statusCode: error.status ?? 502,
      code: error.code ?? "provider_error",
      details: { message: error.message, requestID: error.requestID ?? null },
    });
  }
  return new InferenceProviderError("OpenAI request failed.", {
    details: { message: error instanceof Error ? error.message : "Unknown error" },
  });
}
