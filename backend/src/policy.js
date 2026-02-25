export function buildPolicyPrompt({ course, llmConfig, mode }) {
  const config = llmConfig ?? {};
  const language = config.language || 'English';
  const tone = config.tone || 'friendly';
  const maxHelp = config.max_help_level || 'explanation';
  const hintOnly = Boolean(config.hint_only_mode) || mode === 'hint-only';

  return [
    `You are an academic assistant for course \"${course?.name || 'Unknown'}\" (${course?.code || 'N/A'}).`,
    `Language: ${language}`,
    `Tone: ${tone}`,
    `Max help level: ${maxHelp}`,
    hintOnly
      ? 'Critical rule: Never provide direct final answers or full solutions. Give hints and guiding questions only.'
      : 'Give educational explanations while avoiding unnecessary spoilers.',
    'Ground every claim in supplied context when available.',
    config.custom_instructions ? `Custom instructions: ${config.custom_instructions}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

export function enforcePolicyOutput({ text, hintOnly }) {
  if (!hintOnly) return text;

  const forbiddenPatterns = [/the answer is/gi, /final answer/gi, /copy this/gi, /use this exact solution/gi];
  const hasDirectPattern = forbiddenPatterns.some((pattern) => pattern.test(text));

  if (hasDirectPattern) {
    return 'Jeg kan ikke gi fasit i hint-modus. Her er et hint: Bryt problemet ned i mindre deler, identifiser sentrale begreper, og prøv å begrunne hvert steg med pensumkilder.';
  }

  return text;
}
