import axios from 'axios';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, streamText, dynamicTool, isStepCount, type ModelMessage } from 'ai';
import toolRegistry from '../tools/toolRegistry.js';
import type { ToolContext } from '../types/tools.js';
import {
  containsToolCallArtifact,
  stripToolCallArtifacts,
} from '../utils/toolCallFilter.js';

type Provider = 'openai' | 'openrouter' | 'ollama' | 'other';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: unknown[];
  tool_call_id?: string;
}

interface StreamChunk {
  content: string;
  done: boolean;
}

type StreamCallback = (chunk: StreamChunk) => void;

const MALFORMED_TOOL_CALL_FALLBACK =
  'Maaf, pencarian gagal diproses. Silakan coba lagi sebentar.';
const MAX_TOOL_ROUNDS = 4;

type AISdkTool = ReturnType<typeof dynamicTool>;

export class AIService {
  private provider: Provider;
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private openaiCompat: ReturnType<typeof createOpenAICompatible> | null = null;
  private conversationHistory: Map<string, ChatMessage[]> = new Map();
  private conversationExpiry: Map<string, number> = new Map();
  private readonly GROUP_EXPIRY_MS = 10 * 60 * 1000;

  constructor() {
    this.provider = (process.env.AI_PROVIDER?.toLowerCase() as Provider) || 'openrouter';

    if (this.provider === 'ollama') {
      this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      this.model = process.env.OLLAMA_MODEL || 'llama3.2';
      this.apiKey = '';
    } else if (this.provider === 'openai') {
      this.apiKey = process.env.OPENAI_API_KEY || '';
      this.baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
      this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    } else if (this.provider === 'other') {
      this.apiKey = process.env.OTHER_API_KEY || '';
      this.baseUrl = (process.env.OTHER_BASE_URL || '').replace(/\/+$/, '');
      this.model = process.env.OTHER_MODEL || '';
    } else {
      this.provider = 'openrouter';
      this.apiKey = process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY || '';
      this.baseUrl = (
        process.env.OPENROUTER_BASE_URL ||
        process.env.AI_BASE_URL ||
        'https://openrouter.ai/api/v1'
      ).replace(/\/+$/, '');
      this.model =
        process.env.OPENROUTER_MODEL || process.env.AI_MODEL || 'anthropic/claude-3-haiku';
    }

    if (!this.isConfigured()) {
      let msg: string;
      switch (this.provider) {
        case 'ollama':
          msg = '⚠️ OLLAMA_BASE_URL is not set. AI features will be disabled.';
          break;
        case 'openai':
          msg = '⚠️ OPENAI_API_KEY / AI_API_KEY is not set. AI features will be disabled.';
          break;
        case 'other':
          msg = '⚠️ OTHER_BASE_URL and OTHER_API_KEY are not set. AI features will be disabled.';
          break;
        default:
          msg = '⚠️ OPENROUTER_API_KEY / AI_API_KEY is not set. AI features will be disabled.';
          break;
      }
      console.warn(msg);
    } else {
      console.log(
        `✅ [AIService] Provider: ${this.provider} | Model: ${this.model} | URL: ${this.baseUrl}`,
      );
    }

    if (this.provider !== 'ollama' && this.isConfigured()) {
      const headers: Record<string, string> | undefined =
        this.provider === 'openrouter'
          ? {
              'HTTP-Referer': 'https://github.com/wahyuhp/Bot-Baileys-AI',
              'X-Title': 'Bot-Baileys-AI',
            }
          : undefined;

      this.openaiCompat = createOpenAICompatible({
        name: `bot-baileys-${this.provider}`,
        baseURL: this.baseUrl,
        apiKey: this.apiKey || 'unused',
        headers,
      });
    }
  }

  // ────────────────────────────────────────────────────────────────
  //  AI SDK TOOL BRIDGE
  // ────────────────────────────────────────────────────────────────

  /**
   * Convert registered ToolRegistry entries into AI SDK dynamicTool() definitions.
   * dynamicTool is used instead of tool() because tools are built from a runtime
   * registry and the generic inference on tool() is too narrow for dynamic schemas.
   */
  private buildAISDKTools(toolContext?: ToolContext): Record<string, AISdkTool> {
    const tools: Record<string, AISdkTool> = {};

    for (const [name, entry] of toolRegistry.entries()) {

      const toolDef = {
        description: entry.definition.function.description,
        parameters: entry.definition.function.parameters,
        execute: async (args: unknown) => {
          const result = await entry.execute(args as Record<string, unknown>, toolContext || {});
          return result;
        },
      } as Record<string, unknown>;

      tools[name] = dynamicTool(toolDef as Parameters<typeof dynamicTool>[0]);
    }

    return tools;
  }

  // ────────────────────────────────────────────────────────────────
  //  PUBLIC API
  // ────────────────────────────────────────────────────────────────

  private filterToolCallArtifacts(content: string): string {
    return stripToolCallArtifacts(content);
  }

  getProvider(): Provider {
    return this.provider;
  }

  isConfigured(): boolean {
    if (this.provider === 'ollama') return !!this.baseUrl;
    if (this.provider === 'other') return !!this.baseUrl && !!this.apiKey;
    return !!this.apiKey;
  }

  supportsFunctionCalling(): boolean {
    return this.provider !== 'ollama';
  }

  // ─────────── Non-streaming chat (no tools) ───────────

  async chat(
    sessionId: string,
    userMessage: string,
    systemPrompt?: string,
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error(this.getNotConfiguredMessage());
    }

    const messages = this.getConversationHistory(sessionId);

    if (systemPrompt && messages.length === 0) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: userMessage });

    if (this.provider === 'ollama') {
      return this.callOllamaNonStream(sessionId, messages);
    }

    try {
      const model = this.openaiCompat!.chatModel(this.model);

      const result = await generateText({
        model,
        messages: messages as ModelMessage[],
        allowSystemInMessages: true,
      });

      const assistantMessage = result.text || '';
      messages.push({ role: 'assistant', content: assistantMessage });
      this.conversationHistory.set(sessionId, messages);
      this.setExpiry(sessionId);

      return assistantMessage;
    } catch (error: unknown) {
      const err = error as Error & {
        response?: { data?: { error?: { message?: string } } };
      };
      console.error(`[AIService] ${this.provider} API Error:`, err.response?.data || err.message);
      throw new Error(
        err.response?.data?.error?.message || err.message || 'Failed to get AI response',
      );
    }
  }

  // ─────────── Streaming chat (no tools) ───────────

  async chatStream(
    sessionId: string,
    userMessage: string,
    systemPrompt?: string,
    onChunk?: StreamCallback,
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error(this.getNotConfiguredMessage());
    }

    const messages = this.getConversationHistory(sessionId);

    if (systemPrompt && messages.length === 0) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: userMessage });

    if (this.provider === 'ollama') {
      return this.callOllamaStream(sessionId, messages, onChunk);
    }

    return this.callAISDKStream(sessionId, messages, onChunk);
  }

  // ─────────── Chat with tools (function calling) ───────────

  async chatWithTools(
    sessionId: string,
    userMessage: string,
    systemPrompt?: string,
    onChunk?: StreamCallback,
    toolContext?: ToolContext,
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error(this.getNotConfiguredMessage());
    }

    if (!this.supportsFunctionCalling()) {
      console.log(
        '[AIService] ⚠️ Provider does not support function calling. Falling back to regular chat.',
      );
      return this.chatStream(sessionId, userMessage, systemPrompt, onChunk);
    }

    const messages = this.getConversationHistory(sessionId);

    if (systemPrompt && messages.length === 0) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: userMessage });

    const tools = toolRegistry.hasTools() ? this.buildAISDKTools(toolContext) : undefined;

    return this.callAISDKStream(sessionId, messages, onChunk, tools);
  }

  // ────────────────────────────────────────────────────────────────
  //  AI SDK STREAMING CORE
  // ────────────────────────────────────────────────────────────────

  /**
   * Stream text via AI SDK `streamText`, with optional tools for function calling.
   * The AI SDK handles the tool-calling loop internally via `maxSteps`.
   *
   * IMPORTANT: AI SDK v7 rejects `role: 'system'` inside `messages[]` by
   * default (`allowSystemInMessages` defaults to `false`). System prompts must
   * be passed via `instructions` option (docs: `system` is deprecated).
   * We strip the first system message from the array and pass it separately.
   *
   * Built-in `maxRetries` (default: 2) handles HTTP-level retries. Our loop
   * additionally retries on empty response content — a case the built-in retry
   * does not cover.
   */
  private async callAISDKStream(
    sessionId: string,
    messages: ChatMessage[],
    onChunk?: StreamCallback,
    tools?: Record<string, AISdkTool>,
  ): Promise<string> {
    const MAX_EMPTY_RETRIES = 2;

    for (let attempt = 0; attempt <= MAX_EMPTY_RETRIES; attempt++) {
      try {
        const model = this.openaiCompat!.chatModel(this.model);

        // Keep system messages in the array for proper conversation context.
        // `instructions` option does not map identically to `role: 'system'`
        // for many providers (OpenRouter, OpenAI-compatible endpoints).
        // `allowSystemInMessages: true` tells AI SDK v7 to accept system roles.
        const stopWhen = tools ? isStepCount(MAX_TOOL_ROUNDS) : undefined;

        const result = streamText({
          model,
          messages: messages as ModelMessage[],
          tools,
          maxSteps: tools ? MAX_TOOL_ROUNDS : 1,
          stopWhen,
          allowSystemInMessages: true,
        } as Parameters<typeof streamText>[0]);

        // Use textStream for real-time streaming. Each text delta is emitted
        // as the model generates — including intermediate messages like
        // "Sedang mencari..." before tool calls, and final responses after.
        //
        // With stopWhen: isStepCount(4), the stream now correctly continues
        // through all tool-calling steps.
        //
        // IMPORTANT: AI SDK v7 stream is single-consumer. We must NOT call
        // result.text after consuming textStream — pick one.
        let fullText = '';

        for await (const chunk of result.textStream) {
          fullText += chunk;

          if (onChunk) {
            const visible = this.filterToolCallArtifacts(fullText);
            if (visible) {
              onChunk({ content: visible, done: false });
            }
          }
        }

        if (onChunk) {
          onChunk({ content: '', done: true });
        }

        let cleaned = this.filterToolCallArtifacts(fullText);
        if (!cleaned && fullText && containsToolCallArtifact(fullText)) {
          cleaned = MALFORMED_TOOL_CALL_FALLBACK;
        }

        if (cleaned) {
          messages.push({ role: 'assistant', content: cleaned });
          this.conversationHistory.set(sessionId, messages);
          this.setExpiry(sessionId);
          return cleaned;
        }

        // Empty response on this attempt — only retry if tools were involved
        // (model may need another round with tool results)
        const hadTools = !!tools && Object.keys(tools).length > 0;
        if (attempt < MAX_EMPTY_RETRIES && hadTools) {
          console.warn(
            `[AIService] ⚠️ Empty response (attempt ${attempt + 1}/${MAX_EMPTY_RETRIES + 1}). Retrying...`,
          );
          continue;
        }

        // All retries exhausted — throw so callers can translate to user-friendly message
        const msg = hadTools
          ? 'AI response empty after all retries (tools executed but model returned no text).'
          : 'AI response empty after all retries (model returned no text content).';
        throw new Error(msg);
      } catch (error: unknown) {
        const err = error as Error & {
          response?: { data?: { error?: { message?: string } } };
        };

        // If it's not the last attempt, retry on transient errors
        if (attempt < MAX_EMPTY_RETRIES) {
          const msg = (err.message || '').toLowerCase();
          const isTransient =
            msg.includes('timeout') ||
            msg.includes('econnrefused') ||
            msg.includes('econnreset') ||
            msg.includes('429') ||
            msg.includes('rate limit') ||
            msg.includes('too many') ||
            msg.includes('server error') ||
            msg.includes('503') ||
            msg.includes('502');

          if (isTransient) {
            console.warn(
              `[AIService] ⚠️ Transient error on attempt ${attempt + 1} (${err.message}). Retrying...`,
            );
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
        }

        console.error(
          `[AIService] ${this.provider} API Error:`,
          (err as unknown as Record<string, unknown>).response
            ? (err as unknown as { response?: { data?: unknown } }).response?.data
            : err.message,
        );
        throw new Error(
          (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
            ?.message ||
            err.message ||
            'Failed to get AI response',
        );
      }
    }

    return '';
  }

  // ────────────────────────────────────────────────────────────────
  //  OLLAMA (raw axios — different API surface)
  // ────────────────────────────────────────────────────────────────

  private async callOllamaNonStream(sessionId: string, messages: ChatMessage[]): Promise<string> {
    try {
      const response = await axios.post<{ message?: { content?: string } }>(
        `${this.baseUrl}/api/chat`,
        { model: this.model, messages, stream: false },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000,
        },
      );

      const assistantMessage = response.data?.message?.content || '';

      messages.push({ role: 'assistant', content: assistantMessage });
      this.conversationHistory.set(sessionId, messages);
      this.setExpiry(sessionId);

      return assistantMessage;
    } catch (error: unknown) {
      const err = error as Error & { response?: { data?: { error?: string } } };
      console.error('Ollama API Error:', err.response?.data || err.message);
      throw new Error(
        err.response?.data?.error || err.message || 'Failed to get AI response from Ollama',
      );
    }
  }

  private async callOllamaStream(
    sessionId: string,
    messages: ChatMessage[],
    onChunk?: StreamCallback,
  ): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/chat`,
        { model: this.model, messages, stream: true },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 120000,
          responseType: 'stream',
        },
      );

      return this.handleOllamaStream(sessionId, messages, response.data, onChunk);
    } catch (error: unknown) {
      const err = error as Error & { response?: { data?: { error?: string } } };
      console.error('Ollama API Error:', err.response?.data || err.message);
      throw new Error(
        err.response?.data?.error || err.message || 'Failed to get AI response from Ollama',
      );
    }
  }

  private handleOllamaStream(
    sessionId: string,
    messages: ChatMessage[],
    stream: import('stream').Readable,
    onChunk?: StreamCallback,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let fullContent = '';
      let lineBuffer = '';
      let timeoutId: NodeJS.Timeout;
      let resolved = false;

      const finish = (content: string, isError = false) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);

        let finalContent = this.filterToolCallArtifacts(content || '');
        if (!finalContent && content && containsToolCallArtifact(content)) {
          finalContent = MALFORMED_TOOL_CALL_FALLBACK;
          if (onChunk) onChunk({ content: finalContent, done: false });
        }

        if (finalContent || !isError) {
          if (finalContent) {
            messages.push({ role: 'assistant', content: finalContent });
            this.conversationHistory.set(sessionId, messages);
            this.setExpiry(sessionId);
          }
          resolve(finalContent);
        } else {
          reject(new Error('Empty response from Ollama'));
        }
      };

      timeoutId = setTimeout(() => {
        if (!resolved) {
          stream.emit('end');
          finish(fullContent || '', true);
        }
      }, 120000);

      const processJsonLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        try {
          const parsed = JSON.parse(trimmed);
          const content = parsed.message?.content;
          const done = parsed.done === true;

          if (content) {
            fullContent += content;
            const visibleContent = this.filterToolCallArtifacts(fullContent);
            if (onChunk && visibleContent) {
              onChunk({ content: visibleContent, done: false });
            }
          }

          if (done) {
            if (onChunk) onChunk({ content: '', done: true });
            finish(fullContent);
          }
        } catch {
          // Invalid JSON event — ignored.
        }
      };

      stream.on('data', (chunk: Buffer) => {
        lineBuffer += chunk.toString();
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() || '';
        for (const line of lines) processJsonLine(line);
      });

      stream.on('error', (error: Error) => {
        clearTimeout(timeoutId);
        if (!resolved) {
          resolved = true;
          reject(new Error(error.message || 'Stream error'));
        }
      });

      stream.on('end', () => {
        if (lineBuffer) processJsonLine(lineBuffer);
        finish(fullContent);
      });
    });
  }

  // ────────────────────────────────────────────────────────────────
  //  CONVERSATION HISTORY
  // ────────────────────────────────────────────────────────────────

  getConversationHistory(sessionId: string): ChatMessage[] {
    this.checkAndClearExpired(sessionId);
    return this.conversationHistory.get(sessionId) || [];
  }

  clearConversation(sessionId: string): void {
    this.conversationHistory.delete(sessionId);
    this.conversationExpiry.delete(sessionId);
  }

  private isGroupSession(sessionId: string): boolean {
    return sessionId.includes('@g.us');
  }

  private checkAndClearExpired(sessionId: string): void {
    if (this.isGroupSession(sessionId)) {
      const expiry = this.conversationExpiry.get(sessionId);
      if (expiry && Date.now() > expiry) {
        this.conversationHistory.delete(sessionId);
        this.conversationExpiry.delete(sessionId);
      }
    }
  }

  private setExpiry(sessionId: string): void {
    if (this.isGroupSession(sessionId)) {
      this.conversationExpiry.set(sessionId, Date.now() + this.GROUP_EXPIRY_MS);
    }
  }

  // ────────────────────────────────────────────────────────────────
  //  MODEL CONFIG
  // ────────────────────────────────────────────────────────────────

  setModel(model: string): void {
    this.model = model;
  }

  getModel(): string {
    return this.model;
  }

  private getNotConfiguredMessage(): string {
    switch (this.provider) {
      case 'ollama':
        return 'AI service is not configured. Please set OLLAMA_BASE_URL in .env';
      case 'openai':
        return 'AI service is not configured. Please set OPENAI_API_KEY (or AI_API_KEY) and OPENAI_BASE_URL (or AI_BASE_URL) in .env';
      case 'other':
        return 'AI service is not configured. Please set OTHER_BASE_URL and OTHER_API_KEY in .env';
      default:
        return 'AI service is not configured. Please set OPENROUTER_API_KEY (or AI_API_KEY) and OPENROUTER_BASE_URL (or AI_BASE_URL) in .env';
    }
  }

  static async getAvailableModels(
    provider: Provider,
    baseUrl?: string,
    apiKey?: string,
  ): Promise<string[]> {
    if (provider === 'openrouter') {
      const url = (
        baseUrl || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
      ).replace(/\/+$/, '');
      const key = apiKey || process.env.OPENROUTER_API_KEY || '';
      if (key) {
        try {
          const response = await axios.get<{ data?: Array<{ id: string }> }>(`${url}/models`, {
            headers: { Authorization: `Bearer ${key}` },
            timeout: 10000,
          });
          const models = response.data?.data || [];
          if (models.length > 0) return models.map((m) => m.id).filter(Boolean);
        } catch {
          /* fallback */
        }
      }
      return [
        'qwen/qwen3-next-80b-a3b-instruct:free',
        'openrouter/owl-alpha',
        'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
        'openai/gpt-oss-120b:free',
        'openrouter/free',
      ];
    }

    if (provider === 'openai' || provider === 'other') {
      const defaultUrl =
        provider === 'openai'
          ? (baseUrl ||
              process.env.OPENAI_BASE_URL ||
              process.env.AI_BASE_URL ||
              'https://api.openai.com/v1')
          : (baseUrl || process.env.OTHER_BASE_URL || process.env.AI_BASE_URL || '');
      const defaultKey =
        provider === 'openai'
          ? (apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '')
          : (apiKey || process.env.OTHER_API_KEY || process.env.AI_API_KEY || '');
      const url = defaultUrl.replace(/\/+$/, '');
      const key = defaultKey;
      if (key && url) {
        try {
          const response = await axios.get<{ data?: Array<{ id: string }> }>(`${url}/models`, {
            headers: { Authorization: `Bearer ${key}` },
            timeout: 10000,
          });
          const models = response.data?.data || [];
          if (models.length > 0) return models.map((m) => m.id).filter(Boolean);
        } catch {
          /* return empty */
        }
      }
      return [];
    }

    return [];
  }

  /** @deprecated Use `getAvailableModels('openrouter')` instead. */
  static getAvailableOpenRouterModels(): string[] {
    return [
      'qwen/qwen3-next-80b-a3b-instruct:free',
      'openrouter/owl-alpha',
      'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'openai/gpt-oss-120b:free',
      'openrouter/free',
    ];
  }

  static async listOllamaModels(baseUrl?: string): Promise<string[]> {
    const url = (baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(
      /\/$/,
      '',
    );
    try {
      const response = await axios.get<{ models?: Array<{ name: string }> }>(`${url}/api/tags`, {
        timeout: 10000,
      });
      const models = response.data?.models || [];
      return models.map((m) => m.name).filter(Boolean);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Failed to list Ollama models:', err.message);
      return [];
    }
  }
}

export default new AIService();
