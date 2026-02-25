import type { Env } from '../lib/env.js';

export const getPublicSettingsResponse = (env: Env) => ({
  id: env.APP_ID,
  name: 'Base44 Course Copilot',
  public_settings: {
    auth_required: true,
    help_modes: ['HINT_ONLY', 'ALLOW_SOLUTION'],
    languages: ['Norwegian', 'English'],
    tone_options: ['friendly', 'formal', 'socratic'],
    anonymized_dashboard: true,
    gdpr_ready: true
  }
});
