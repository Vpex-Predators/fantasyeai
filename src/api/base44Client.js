import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  // Keep Base44-hosted app behavior, but support an independently hosted preview.
  serverUrl: import.meta.env.VITE_BASE44_SERVER_URL || '',
  appBaseUrl
});
