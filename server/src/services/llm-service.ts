import type { Course } from '@prisma/client';
import type { Env } from '../lib/env.js';
import type { HelpMode } from './policy-engine.js';
import { enforceHintMode } from './policy-engine.js';

interface RagChunkContext {
  content: string;
  score: number;
}

type JsonSchema = {
  properties?: Record<string, unknown>;
};

export interface GenerateOptions {
  prompt: string;
  course?: Course | null;
  policyInstructions: string;
  helpMode: HelpMode;
  ragContext: RagChunkContext[];
  responseSchema?: JsonSchema | null;
}

export class LLMService {
  constructor(private env: Env) {}

  async generate(options: GenerateOptions): Promise<string | Record<string, unknown>> {
    const provider = this.env.LLM_PROVIDER;
    if (provider === 'ollama') {
      return this.callOllama(options);
    }
    if (provider === 'openai') {
      return this.callOpenAI(options);
    }
    return this.generateMock(options);
  }

  private buildPrompt({ prompt, policyInstructions, ragContext }: GenerateOptions) {
    const contextBlock = ragContext.length
      ? `\nRelevant faginnhold:\n${ragContext
          .map((chunk, idx) => `(${idx + 1}) ${chunk.content}`)
          .join('\n\n')}`
      : '';
    return `${policyInstructions}\nBruk faglig kontekst nedenfor før du svarer.\n${contextBlock}\n\nStudent prompt:\n${prompt}`;
  }

  private async callOllama(options: GenerateOptions) {
    const payload = {
      model: this.env.OLLAMA_MODEL,
      stream: false,
      messages: [
        { role: 'system', content: options.policyInstructions },
        { role: 'user', content: this.buildPrompt(options) }
      ]
    };
    const response = await fetch(`${this.env.OLLAMA_BASE_URL.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw Object.assign(new Error('Failed to reach Ollama'), { status: 500 });
    }
    const data = await response.json() as { message?: { content?: string } };
    const text = data.message?.content ?? 'Jeg klarte ikke å generere et svar akkurat nå.';
    return options.helpMode === 'HINT_ONLY' ? enforceHintMode(text) : text;
  }

  private async callOpenAI(options: GenerateOptions) {
    if (!this.env.OPENAI_API_KEY) {
      throw Object.assign(new Error('OPENAI_API_KEY missing'), { status: 500 });
    }
    const body: Record<string, unknown> = {
      model: this.env.OPENAI_MODEL,
      messages: [
        { role: 'system', content: options.policyInstructions },
        { role: 'user', content: this.buildPrompt(options) }
      ]
    };
    if (options.responseSchema) {
      body.response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'structured_response',
          schema: options.responseSchema
        }
      };
    }
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const result = await response.json() as any;
    const rawText = result.choices?.[0]?.message?.content ?? '';
    if (options.responseSchema) {
      try {
        return JSON.parse(rawText);
      } catch {
        return JSON.parse(JSON.stringify(options.responseSchema));
      }
    }
    const finalText = options.helpMode === 'HINT_ONLY' ? enforceHintMode(rawText) : rawText;
    return finalText || 'Jeg klarer ikke å svare på det akkurat nå.';
  }

  private generateMock(options: GenerateOptions) {
    if (options.responseSchema?.properties?.flashcards) {
      return this.mockFlashcards(options);
    }
    if (options.responseSchema?.properties?.overall_comment) {
      return this.mockFeedback(options);
    }
    const context = options.ragContext[0]?.content ?? 'Oppsummer forelesningsnotatene dine.';
    const base = `Basert på notatene: ${context.slice(0, 200)}...`; 
    const text = `${base} Forsøk å bryte problemet ned i mindre steg og vurder hva du vet allerede.`;
    return options.helpMode === 'HINT_ONLY' ? enforceHintMode(text) : text;
  }

  private mockFlashcards(options: GenerateOptions) {
    const topicMatch = options.prompt.match(/Focus on the topic:\s*(.+)/i);
    const topic = topicMatch?.[1]?.split('\n')[0]?.trim() ?? 'Kjernebegreper';
    const courseName = options.course?.name ?? 'faget';
    const cards = Array.from({ length: 5 }).map((_, index) => ({
      front: `Hva betyr ${topic} i ${courseName}? (kort ${index + 1})`,
      back: `Tenk på hvordan ${topic} brukes i ${courseName} og gi et konkret eksempel.`,
      topic,
      difficulty: index < 2 ? 'easy' : index < 4 ? 'medium' : 'hard'
    }));
    return { flashcards: cards };
  }

  private mockFeedback(options: GenerateOptions) {
    const prompt = options.prompt;
    const questionMatches = [...prompt.matchAll(/Question\s+\d+:\s*(.*?)\n/gm)];
    const feedback = questionMatches.map((match, idx) => ({
      question_id: `q${idx + 1}`,
      comment: `Reflekter mer rundt «${match[1]}» og koble til pensum.`,
      score: 70
    }));
    return {
      overall_comment: 'Du viser forståelse, men utdyp resonnementene dine med flere begreper fra kurset.',
      strengths: ['God struktur i svarene', 'Refererer til sentrale konsepter'],
      improvements: ['Bruk konkrete eksempler', 'Knyt svarene tettere til teori fra kurset'],
      question_feedback: feedback
    };
  }
}
