/**
 * Anthropic Claude Client Wrapper
 * 
 * Safely manages API requests, authentication, timeouts, and model fallbacks.
 * Keeps API keys strictly on the server.
 */

import Anthropic from '@anthropic-ai/sdk';

export interface ClaudeClientOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export class ClaudeClient {
  private client: Anthropic | null = null;
  private readonly defaultModel = 'claude-3-5-sonnet-20241022';
  private readonly fallbackModel = 'claude-3-5-haiku-20241022';

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (key && key.trim().length > 10 && !key.includes('your_anthropic_api_key')) {
      this.client = new Anthropic({ apiKey: key.trim() });
    }
  }

  public isConfigured(): boolean {
    return this.client !== null;
  }

  public async createMessage(
    systemPrompt: string,
    userPrompt: string,
    options: ClaudeClientOptions = {}
  ): Promise<string | null> {
    if (!this.client) {
      return null;
    }

    const model = options.model || this.defaultModel;
    const maxTokens = options.maxTokens || 1500;
    const temperature = options.temperature ?? 0;
    const timeout = options.timeoutMs || 25000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await this.client.messages.create(
        {
          model,
          max_tokens: maxTokens,
          temperature,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        },
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      const content = response.content[0];
      if (content && content.type === 'text') {
        return content.text;
      }
      return null;
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn(`[ClaudeClient] Primary request failed with model ${model}:`, err.message || err);

      // Attempt fallback model if first model had permission/availability error
      if (model !== this.fallbackModel) {
        try {
          const fallbackRes = await this.client.messages.create({
            model: this.fallbackModel,
            max_tokens: maxTokens,
            temperature,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          });
          const content = fallbackRes.content[0];
          if (content && content.type === 'text') {
            return content.text;
          }
        } catch (fallbackErr: any) {
          console.warn('[ClaudeClient] Fallback request also failed:', fallbackErr.message || fallbackErr);
        }
      }

      return null;
    }
  }
}

// Singleton server client instance
export const claudeClient = new ClaudeClient();
