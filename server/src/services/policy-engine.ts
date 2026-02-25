import type { Course } from '@prisma/client';

export type HelpMode = 'HINT_ONLY' | 'ALLOW_SOLUTION';

interface PolicyResult {
  instructions: string;
  helpMode: HelpMode;
}

export const derivePolicy = (course?: Course | null): PolicyResult => {
  const config = (course?.llm_config as Record<string, unknown>) ?? {};
  const helpMode: HelpMode = config.hint_only_mode ? 'HINT_ONLY' : 'ALLOW_SOLUTION';
  const language = typeof config.language === 'string' ? config.language : 'English';
  const tone = typeof config.tone === 'string' ? config.tone : 'friendly';
  const maxHelp = typeof config.max_help_level === 'string' ? config.max_help_level : 'explanation';
  const custom = typeof config.custom_instructions === 'string' ? config.custom_instructions : '';

  const baseInstructions = [
    `Respond in ${language}.`,
    `Keep a ${tone} tone with short paragraphs.`,
    `Do not exceed the allowed help level: ${maxHelp}.`
  ];

  if (helpMode === 'HINT_ONLY') {
    baseInstructions.push('Only provide hints or guiding questions. Never give away final answers.');
  }
  if (custom) {
    baseInstructions.push(custom);
  }

  return {
    helpMode,
    instructions: baseInstructions.join(' ')
  };
};

export const enforceHintMode = (text: string): string => {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 3);
  const hints = sentences.map((sentence, index) => `Hint ${index + 1}: ${sentence.trim()}`);
  return `${hints.join('\n')}\nHva gjør du som neste steg?`;
};
