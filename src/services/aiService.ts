import axios from 'axios';
import toolRegistry from '../tools/toolRegistry.js';
import type { AIToolCall as AIToolCallType, ToolContext } from '../types/tools.js';

type Provider = 'openai' | 'openrouter' | 'ollama' | 'other';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: AIToolCallType[];
  tool_call_id?: string;
}

interface StreamChunk {
  content: string;
  done: boolean;
}

type StreamCallback = (chunk: StreamChunk) => void;

const OPENAI_COMPATIBLE_ENDPOINT = '/chat/completions';

export class AIService {
  private provider: Provider;
  private apiKey: string;
  private baseUrl: string;
  private model: string;
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
      // openrouter (default / backward compatible)
      this.provider = 'openrouter';
      this.apiKey = process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY || '';
      this.baseUrl = (process.env.OPENROUTER_BASE_URL || process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
      this.model = process.env.OPENROUTER_MODEL || process.env.AI_MODEL || 'anthropic/claude-3-haiku';
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
      console.log(`✅ [AIService] Provider: ${this.provider} | Model: ${this.model} | URL: ${this.baseUrl}`);
    }
  }

  getProvider(): Provider {
    return this.provider;
  }

  isConfigured(): boolean {
    if (this.provider === 'ollama') {
      return !!this.baseUrl;
    }
    if (this.provider === 'other') {
      return !!this.baseUrl && !!this.apiKey;
    }
    return !!this.apiKey;
  }

  /**
   * Check if the current provider supports function calling / tool use.
   * Ollama does not support it; others do.
   */
  supportsFunctionCalling(): boolean {
    return this.provider !== 'ollama';
  }

  async chat(
    sessionId: string,
    userMessage: string,
    systemPrompt?: string
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
    return this.callOpenAICompatibleNonStream(sessionId, messages);
  }

  async chatStream(
    sessionId: string,
    userMessage: string,
    systemPrompt?: string,
    onChunk?: StreamCallback
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
    return this.callOpenAICompatibleStream(sessionId, messages, onChunk);
  }

  // ────────────────────────────────────────────────────────────────
  //  FUNCTION CALLING (TOOL USE) SUPPORT
  // ────────────────────────────────────────────────────────────────

  /**
   * Chat with tool/function calling support.
   *
   * Flow:
   *   1. Send message + registered tools to AI
   *   2. If AI responds with tool_calls → execute tools, send results back, get final answer
   *   3. If AI responds normally → return response directly
   *
   * For Ollama (no function calling), falls back to regular chatStream.
   *
   * @param toolContext - Socket context so tools can send media directly to the user
   */
  async chatWithTools(
    sessionId: string,
    userMessage: string,
    systemPrompt?: string,
    onChunk?: StreamCallback,
    toolContext?: ToolContext
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error(this.getNotConfiguredMessage());
    }

    // ── Ollama: no function calling → regular stream ──
    if (!this.supportsFunctionCalling()) {
      console.log('[AIService] ⚠️ Provider does not support function calling. Falling back to regular chat.');
      return this.chatStream(sessionId, userMessage, systemPrompt, onChunk);
    }

    const messages = this.getConversationHistory(sessionId);

    if (systemPrompt && messages.length === 0) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: userMessage });

    // Get registered tool definitions
    const tools = toolRegistry.hasTools() ? toolRegistry.getApiDefinitions() : undefined;

    // ── Step 1: Make initial request with tools ──
    const firstResponse = await this.callOpenAIWithTools(messages, tools);

    // ── Step 2: Check if AI wants to use tools ──
    if (firstResponse.tool_calls && firstResponse.tool_calls.length > 0) {
      console.log(`[AIService] 🔧 AI requested ${firstResponse.tool_calls.length} tool call(s)`);

      // Add assistant message with tool_calls to history
      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: firstResponse.tool_calls,
      });

      // Show "processing" status to user
      if (toolContext?.socket && toolContext?.fromJid) {
        await toolContext.socket.sendPresenceUpdate('composing', toolContext.fromJid);
      }

      // Execute tool calls
      const toolResults = await toolRegistry.executeToolCalls(firstResponse.tool_calls, toolContext || {});

      // Add tool results to messages
      for (const result of toolResults) {
        messages.push(result);
      }

      // Save intermediate state (without final response yet)
      this.conversationHistory.set(sessionId, messages);
      this.setExpiry(sessionId);

      // ── Step 3: Get final response with tool results ──
      // Use streaming for the final answer so user sees typing effect
      return this.callOpenAICompatibleStream(sessionId, messages, onChunk);
    }

    // ── No tool calls: return content directly ──
    const content = firstResponse.content || '';

    messages.push({ role: 'assistant', content });
    this.conversationHistory.set(sessionId, messages);
    this.setExpiry(sessionId);

    // Emit content first, then done, so handler's `!chunk.done` check captures it
    if (onChunk) {
      if (content) {
        onChunk({ content, done: false });
      }
      onChunk({ content: '', done: true });
    }

    return content;
  }

  /**
   * Make a non-streaming request to the OpenAI-compatible API with optional tools.
   * Returns both content and possible tool_calls.
   */
  private async callOpenAIWithTools(
    messages: ChatMessage[],
    tools?: any[]
  ): Promise<{ content: string | null; tool_calls?: AIToolCallType[] }> {
    try {
      const body: Record<string, any> = {
        model: this.model,
        messages: messages,
        stream: false,
      };

      if (tools && tools.length > 0) {
        body.tools = tools;
      }

      const response = await axios.post<any>(
        `${this.baseUrl}${OPENAI_COMPATIBLE_ENDPOINT}`,
        body,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      const choice = response.data.choices?.[0];
      const message = choice?.message;

      if (!message) {
        return { content: null };
      }

      // Check for tool_calls in response
      if (message.tool_calls && message.tool_calls.length > 0) {
        return {
          content: null,
          tool_calls: message.tool_calls.map((tc: any) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.function?.name || '',
              arguments: tc.function?.arguments || '{}',
            },
          })),
        };
      }

      return { content: message.content || '' };
    } catch (error: any) {
      console.error(`[AIService] ${this.provider} API Error (tools):`, error.response?.data || error.message);
      throw new Error(
        error.response?.data?.error?.message ||
        error.response?.data?.error ||
        'Failed to get AI response'
      );
    }
  }

  // ─────────── OpenAI-compatible (openai | openrouter) ───────────

  private async callOpenAICompatibleNonStream(sessionId: string, messages: ChatMessage[]): Promise<string> {
    try {
      const response = await axios.post<any>(
        `${this.baseUrl}${OPENAI_COMPATIBLE_ENDPOINT}`,
        {
          model: this.model,
          messages: messages,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      const assistantMessage = response.data.choices[0]?.message?.content || '';

      messages.push({ role: 'assistant', content: assistantMessage });
      this.conversationHistory.set(sessionId, messages);
      this.setExpiry(sessionId);

      return assistantMessage;
    } catch (error: any) {
      console.error(`[AIService] ${this.provider} API Error:`, error.response?.data || error.message);
      throw new Error(
        error.response?.data?.error?.message ||
        error.response?.data?.error ||
        'Failed to get AI response'
      );
    }
  }

  private async callOpenAICompatibleStream(
    sessionId: string,
    messages: ChatMessage[],
    onChunk?: StreamCallback
  ): Promise<string> {
    try {
      const body: Record<string, any> = {
        model: this.model,
        messages: messages,
        stream: true,
      };

      // NOTE: Do NOT send tool definitions here.
      // Tools are only sent in the initial non-streaming request (callOpenAIWithTools).
      // Sending tools in the streaming final step causes some models to write
      // tool invocations as visible text instead of using proper function calling.

      const response = await axios.post(
        `${this.baseUrl}${OPENAI_COMPATIBLE_ENDPOINT}`,
        body,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000,
          responseType: 'stream',
        }
      );

      const stream = response.data;
      return this.handleOpenAICompatibleSSEStream(sessionId, messages, stream, onChunk);
    } catch (error: any) {
      console.error(`[AIService] ${this.provider} API Error:`, error.response?.data || error.message);
      throw new Error(
        error.response?.data?.error?.message ||
        error.response?.data?.error?.message ||
        error.message ||
        'Failed to get AI response'
      );
    }
  }

  private handleOpenAICompatibleSSEStream(
    sessionId: string,
    messages: ChatMessage[],
    stream: any,
    onChunk?: StreamCallback
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let fullContent = '';
      let buffer = '';
      let timeoutId: NodeJS.Timeout;
      let resolved = false;

      const finish = (content: string, isError = false) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);

        if (content || !isError) {
          if (content) {
            messages.push({ role: 'assistant', content });
            this.conversationHistory.set(sessionId, messages);
            this.setExpiry(sessionId);
          }
          resolve(content);
        } else {
          reject(new Error('Empty response from AI'));
        }
      };

      timeoutId = setTimeout(() => {
        if (!resolved) {
          stream.emit('end');
          finish(fullContent || '', true);
        }
      }, 60000);

      stream.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              if (onChunk) onChunk({ content: '', done: true });
              finish(fullContent);
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;

              if (content) {
                fullContent += content;
                buffer += content;

                if (onChunk) {
                  onChunk({ content: buffer, done: false });
                }
              }
            } catch (e) {
            }
          }
        }
      });

      stream.on('error', (error: any) => {
        clearTimeout(timeoutId);
        if (!resolved) {
          resolved = true;
          reject(new Error(error.message || 'Stream error'));
        }
      });

      stream.on('end', () => {
        finish(fullContent);
      });
    });
  }

  private async callOllamaNonStream(sessionId: string, messages: ChatMessage[]): Promise<string> {
    try {
      const response = await axios.post<any>(
        `${this.baseUrl}/api/chat`,
        {
          model: this.model,
          messages: messages,
          stream: false,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000,
        }
      );

      const assistantMessage = response.data?.message?.content || '';

      messages.push({ role: 'assistant', content: assistantMessage });
      this.conversationHistory.set(sessionId, messages);
      this.setExpiry(sessionId);

      return assistantMessage;
    } catch (error: any) {
      console.error('Ollama API Error:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.error ||
        error.message ||
        'Failed to get AI response from Ollama'
      );
    }
  }

  private async callOllamaStream(
    sessionId: string,
    messages: ChatMessage[],
    onChunk?: StreamCallback
  ): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/chat`,
        {
          model: this.model,
          messages: messages,
          stream: true,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 120000,
          responseType: 'stream',
        }
      );

      const stream = response.data;
      return this.handleOllamaStream(sessionId, messages, stream, onChunk);
    } catch (error: any) {
      console.error('Ollama API Error:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.error ||
        error.message ||
        'Failed to get AI response from Ollama'
      );
    }
  }

  private handleOllamaStream(
    sessionId: string,
    messages: ChatMessage[],
    stream: any,
    onChunk?: StreamCallback
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let fullContent = '';
      let buffer = '';
      let timeoutId: NodeJS.Timeout;
      let resolved = false;

      const finish = (content: string, isError = false) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);

        if (content || !isError) {
          if (content) {
            messages.push({ role: 'assistant', content });
            this.conversationHistory.set(sessionId, messages);
            this.setExpiry(sessionId);
          }
          resolve(content);
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

      stream.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const parsed = JSON.parse(trimmed);
            const content = parsed.message?.content;
            const done = parsed.done === true;

            if (content) {
              fullContent += content;
              buffer += content;

              if (onChunk) {
                onChunk({ content: buffer, done: false });
              }
            }

            if (done) {
              if (onChunk) onChunk({ content: '', done: true });
              finish(fullContent);
              return;
            }
          } catch (e) {
          }
        }
      });

      stream.on('error', (error: any) => {
        clearTimeout(timeoutId);
        if (!resolved) {
          resolved = true;
          reject(new Error(error.message || 'Stream error'));
        }
      });

      stream.on('end', () => {
        finish(fullContent);
      });
    });
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

  setModel(model: string): void {
    this.model = model;
  }

  getModel(): string {
    return this.model;
  }

  /**
   * Ambil daftar model untuk provider OpenAI-compatible (openai | openrouter | other).
   * Untuk OpenRouter: coba fetch dari API OpenRouter, fallback ke hardcoded list.
   * Untuk OpenAI / Other custom: coba fetch dari endpoint /models.
   */
  static async getAvailableModels(provider: Provider, baseUrl?: string, apiKey?: string): Promise<string[]> {
    if (provider === 'openrouter') {
      // Coba fetch dari OpenRouter API
      const url = (baseUrl || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
      const key = apiKey || process.env.OPENROUTER_API_KEY || '';
      if (key) {
        try {
          const response = await axios.get<any>(`${url}/models`, {
            headers: { 'Authorization': `Bearer ${key}` },
            timeout: 10000,
          });
          const models = response.data?.data || [];
          if (models.length > 0) return models.map((m: any) => m.id).filter(Boolean);
        } catch { /* fallback to hardcoded */ }
      }
      // Fallback: hardcoded popular free models
      return [
        'qwen/qwen3-next-80b-a3b-instruct:free',
        'openrouter/owl-alpha',
        'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
        'openai/gpt-oss-120b:free',
        'openrouter/free',
      ];
    }

    if (provider === 'openai' || provider === 'other') {
      // Coba fetch dari endpoint /models dari API yg compatible
      const defaultUrl = provider === 'openai'
        ? (baseUrl || process.env.OPENAI_BASE_URL || process.env.AI_BASE_URL || 'https://api.openai.com/v1')
        : (baseUrl || process.env.OTHER_BASE_URL || process.env.AI_BASE_URL || '');
      const defaultKey = provider === 'openai'
        ? (apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '')
        : (apiKey || process.env.OTHER_API_KEY || process.env.AI_API_KEY || '');
      const url = defaultUrl.replace(/\/+$/, '');
      const key = defaultKey;
      if (key && url) {
        try {
          const response = await axios.get<any>(`${url}/models`, {
            headers: { 'Authorization': `Bearer ${key}` },
            timeout: 10000,
          });
          const models = response.data?.data || [];
          if (models.length > 0) return models.map((m: any) => m.id).filter(Boolean);
        } catch { /* return empty */ }
      }
      return [];
    }

    return [];
  }

  /**
   * Fetch available models from OpenRouter API.
   * @deprecated Use `getAvailableModels('openrouter')` instead.
   */
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
    const url = (baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
    try {
      const response = await axios.get<any>(`${url}/api/tags`, { timeout: 10000 });
      const models = response.data?.models || [];
      return models.map((m: any) => m.name).filter(Boolean);
    } catch (error: any) {
      console.error('Failed to list Ollama models:', error.message);
      return [];
    }
  }
}

export default new AIService();
