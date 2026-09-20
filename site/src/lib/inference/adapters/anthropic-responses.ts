// The Cut chat agent's hosted Claude option. Same shape as
// gemini-responses.ts/openai-chat-responses.ts (createResponse/
// createResponseStream, the normalized {output_text, output, usage} body)
// but talks to the Anthropic Messages API, whose content-block model differs
// from the wire format's Gemini-flavored shape in two ways worth naming:
// a tool call rides INSIDE the assistant turn's content array as a
// `tool_use` block (not a flat sibling item, as OpenAI wants it), and its
// result rides inside the FOLLOWING user turn's content as a `tool_result`
// block paired by `tool_use_id` (not its own top-level item either).
import Anthropic, { APIError } from "@anthropic-ai/sdk";
import type {
  ContentBlockParam,
  Message,
  MessageParam,
  MessageStreamEvent,
  Tool as AnthropicTool,
} from "@anthropic-ai/sdk/resources/messages";

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
import { anthropicModels } from "@/lib/inference/anthropic-models";

type AdapterEnvironment = Record<string, string | undefined>;

const providerID = "anthropic-responses";
const anthropicProviderID = "anthropic";
const defaultModel = anthropicModels.chat;
// The API requires an explicit cap; the agent's own round/step budget is
// what actually bounds a turn, so this just needs to be generous enough
// that a real reply never gets cut off mid-tool-call.
const DEFAULT_MAX_TOKENS = 8192;

const IMAGE_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export function createAnthropicResponsesProvider(
  environment: AdapterEnvironment = process.env,
): InferenceProvider {
  const apiKey = environment.ANTHROPIC_API_KEY?.trim() ?? "";
  const configured = apiKey.length > 0;
  const client = () => new Anthropic({ apiKey });

  async function listModels(modalities: InferenceModality[]) {
    const requested = modalities.length > 0 ? modalities : ["text"];
    if (!requested.includes("text") || !apiKey) {
      return [];
    }
    return [staticModel(defaultModel)];
  }

  function requestParameters(request: ResponseCreateRequest) {
    const model = requestedModel(request.body, defaultModel);
    const messages = anthropicMessages(request.body.input);
    const tools = anthropicTools(request.body.tools);
    const system = stringValue(request.body.instructions);
    const maxTokens = numberValue(request.body.max_output_tokens) ?? DEFAULT_MAX_TOKENS;
    return {
      model,
      max_tokens: maxTokens,
      messages,
      ...(system ? { system } : {}),
      ...(tools.length > 0 ? { tools } : {}),
    };
  }

  async function createResponse(
    request: ResponseCreateRequest,
  ): Promise<ResponseCreateResult> {
    ensureConfigured(configured);
    const params = requestParameters(request);
    try {
      const message = await client().messages.create(params);
      const body = normalizedAnthropicResponse(message as Message);
      return {
        provider: anthropicProviderID,
        model: params.model,
        body,
        usage: isJsonObject(body) ? body.usage : undefined,
        metadata: { provider: anthropicProviderID, api: "messages" },
      };
    } catch (error) {
      throw anthropicProviderError(error);
    }
  }

  async function createResponseStream(
    request: ResponseCreateRequest,
  ): Promise<ResponseStreamResult> {
    ensureConfigured(configured);
    const params = requestParameters(request);
    let stream: AsyncIterable<MessageStreamEvent> & { finalMessage: () => Promise<Message> };
    try {
      stream = client().messages.stream(params);
    } catch (error) {
      throw anthropicProviderError(error);
    }
    return {
      provider: anthropicProviderID,
      model: params.model,
      events: responseStreamEvents(stream),
      metadata: { provider: anthropicProviderID, api: "messages" },
    };
  }

  return {
    id: providerID,
    configured,
    capabilities: ["text", "image"],
    responseProviderIDs: [anthropicProviderID],
    canCreateResponse: () => true,
    handlesResponseMedia: (request) => !hasUnsupportedMediaPart(request.body.input),
    listModels,
    createResponse,
    createResponseStream,
  };
}

// Text deltas forward live for the UI as they stream in; the SDK's own
// finalMessage() resolves once the stream ends with the fully aggregated
// Message (parsed tool_use inputs included), so — like the OpenAI adapter —
// there is no manual content-block accumulation to hand-roll here.
async function* responseStreamEvents(
  stream: AsyncIterable<MessageStreamEvent> & { finalMessage: () => Promise<Message> },
): AsyncGenerator<ResponseStreamEvent> {
  try {
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta" &&
        event.delta.text
      ) {
        yield { type: "output_text_delta", delta: event.delta.text };
      }
    }
  } catch (error) {
    throw anthropicProviderError(error);
  }
  const message = await stream.finalMessage();
  const body = normalizedAnthropicResponse(message);
  yield { type: "completed", body, usage: isJsonObject(body) ? body.usage : undefined };
}

// The wire body's own Responses-shaped output (see gemini-responses.ts's
// normalizedGeminiResponse) — output_text plus a message item and one
// function_call item per tool_use block. Anthropic's tool_use.input already
// arrives as a parsed object, unlike OpenAI's JSON-string arguments.
function normalizedAnthropicResponse(message: Message): JsonObject {
  const textParts: string[] = [];
  const calls: JsonObject[] = [];
  for (const block of message.content) {
    if (block.type === "text") {
      if (block.text) textParts.push(block.text);
    } else if (block.type === "tool_use") {
      calls.push({
        id: block.id,
        name: block.name,
        arguments: isJsonObject(toJsonValue(block.input)) ? (toJsonValue(block.input) as JsonObject) : {},
      });
    }
  }

  return {
    id: message.id,
    object: "response",
    output_text: textParts.join("\n").trim(),
    output: [
      { type: "message", role: "assistant", content: textParts.map((text) => ({ type: "output_text", text })) },
      ...calls.map((call) => ({ type: "function_call", ...call })),
    ],
    provider_output: toJsonValue(message),
    usage: toJsonValue(message.usage),
  };
}

function anthropicTools(rawTools: JsonValue | undefined): AnthropicTool[] {
  if (!Array.isArray(rawTools)) return [];
  const tools: AnthropicTool[] = [];
  for (const tool of rawTools) {
    if (!isJsonObject(tool) || tool.type !== "function") continue;
    const name = stringValue(tool.name);
    if (!name) continue;
    const parameters = isJsonObject(tool.parameters) ? tool.parameters : { type: "object" as const };
    tools.push({
      name,
      description: stringValue(tool.description),
      input_schema: { ...parameters, type: "object" },
    });
  }
  return tools;
}

// Wire input items → alternating Anthropic user/assistant turns. A
// functionCall part becomes a tool_use block inside the current assistant
// turn's content; a function_response part becomes a tool_result block
// inside the current user turn's content — both paired by id, not emitted
// as their own flat items the way the OpenAI adapter's wire shape wants.
function anthropicMessages(input: JsonValue | undefined): MessageParam[] {
  if (typeof input === "string") {
    return [{ role: "user", content: [{ type: "text", text: input }] }];
  }
  if (!Array.isArray(input)) return [];

  const messages: MessageParam[] = [];
  let bufferRole: "user" | "assistant" | null = null;
  let buffer: ContentBlockParam[] = [];
  const flush = () => {
    if (bufferRole && buffer.length > 0) {
      messages.push({ role: bufferRole, content: buffer });
    }
    bufferRole = null;
    buffer = [];
  };
  const push = (role: "user" | "assistant", block: ContentBlockParam) => {
    if (bufferRole !== role) flush();
    bufferRole = role;
    buffer.push(block);
  };

  for (const rawItem of input) {
    if (!isJsonObject(rawItem)) continue;
    const role = stringValue(rawItem.role) === "assistant" ? "assistant" : "user";
    const parts = Array.isArray(rawItem.content) ? rawItem.content : [rawItem.content];
    for (const part of parts) {
      if (!isJsonObject(part)) {
        if (typeof part === "string" && part) push(role, { type: "text", text: part });
        continue;
      }
      const functionCall = isJsonObject(part.functionCall)
        ? part.functionCall
        : isJsonObject(part.function_call)
          ? part.function_call
          : null;
      if (functionCall) {
        push("assistant", {
          type: "tool_use",
          id: stringValue(functionCall.id) ?? "",
          name: stringValue(functionCall.name) ?? "unknown_function",
          input: functionCall.args ?? {},
        });
        continue;
      }
      const functionResponse = isJsonObject(part.functionResponse)
        ? part.functionResponse
        : part.type === "function_response"
          ? part
          : null;
      if (functionResponse) {
        push("user", {
          type: "tool_result",
          tool_use_id: stringValue(functionResponse.id) ?? "",
          content: JSON.stringify(functionResponse.response ?? null),
        });
        continue;
      }
      if (part.type === "input_image" || part.type === "image") {
        const image = imageBlock(part);
        if (image) push("user", image);
        continue;
      }
      if (
        part.type === "input_audio" ||
        part.type === "audio" ||
        part.type === "input_video" ||
        part.type === "video"
      ) {
        // Claude's Messages API takes no raw audio/video input — degrade to
        // a text note rather than dropping the turn. handlesResponseMedia
        // already steers the router away from this adapter when the
        // request carries media it can't take; this is a defensive
        // fallback.
        push(role, { type: "text", text: "[unsupported media part: audio/video input]" });
        continue;
      }
      const text = stringValue(part.text);
      if (text) push(role, { type: "text", text });
    }
  }
  flush();
  return messages;
}

function imageBlock(part: JsonObject): ContentBlockParam | null {
  const rawMediaType = stringValue(part.mimeType) || stringValue(part.mime_type) || "image/png";
  const mediaType = (IMAGE_MEDIA_TYPES.has(rawMediaType) ? rawMediaType : "image/png") as
    | "image/jpeg"
    | "image/png"
    | "image/gif"
    | "image/webp";
  const base64 = stringValue(part.dataBase64) || stringValue(part.data_base64);
  if (base64) {
    return { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };
  }
  const url = stringValue(part.url) || stringValue(part.image_url);
  if (url) {
    return { type: "image", source: { type: "url", url } };
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
// ("claude-sonnet-5-hosted") to keep it from colliding with the same id
// under the local-CLI "claude" provider group (see aiModels.ts) — strip it
// back to the real Messages API model string before calling Anthropic.
function requestedModel(body: JsonObject, fallback: string) {
  const model = body.model;
  if (typeof model !== "string" || !model.trim()) return fallback;
  return model.endsWith("-hosted") ? model.slice(0, -"-hosted".length) : model;
}

function ensureConfigured(configured: boolean) {
  if (!configured) {
    throw new InferenceProviderError("Anthropic is not configured on this deployment.", {
      statusCode: 503,
      code: "missing_provider_credentials",
    });
  }
}

function staticModel(model: string): InferenceModel {
  return {
    id: model,
    name: model,
    provider: anthropicProviderID,
    inputModalities: ["text", "image"],
    outputModalities: ["text"],
    contextLength: null,
    pricing: null,
    metadata: { provider: anthropicProviderID, api: "messages" },
  };
}

function numberValue(value: JsonValue | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: JsonValue | unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function anthropicProviderError(error: unknown) {
  // The streaming SSE error frame only forwards `.message` (see
  // depcutStream.ts's readStream), so the real cause otherwise never
  // reaches anywhere a caller can see it — log it here.
  console.error("[anthropic-responses] request failed", error);
  if (error instanceof APIError) {
    return new InferenceProviderError("Anthropic request failed.", {
      statusCode: error.status ?? 502,
      code: error.type ?? "provider_error",
      details: { message: error.message, requestID: error.requestID ?? null },
    });
  }
  return new InferenceProviderError("Anthropic request failed.", {
    details: { message: error instanceof Error ? error.message : "Unknown error" },
  });
}
