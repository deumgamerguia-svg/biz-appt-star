// Server-side Supabase client with a privileged key. Keep this module server-only.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function isOpaqueSupabaseKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

/**
 * Supabase's new sb_secret_/sb_publishable_ keys are opaque API keys, not JWTs.
 * supabase-js may add `Authorization: Bearer <key>` automatically; that header
 * is valid for legacy JWT keys but makes opaque keys fail with "Invalid API key".
 */
function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      isOpaqueSupabaseKey(supabaseKey) &&
      headers.get('Authorization') === `Bearer ${supabaseKey}`
    ) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createSupabaseAdminClient() {
  // Prefer deployment/runtime variables so URL and secret always belong to the
  // same connected Supabase project. Keep the repository URL only as a safe
  // compatibility fallback for existing deployments.
  const SUPABASE_URL =
    process.env['SUPABASE_URL'] ||
    process.env['VITE_SUPABASE_URL'] ||
    'https://qagotnmdqjoodoudcikd.supabase.co';

  // Supabase supports both the current sb_secret_ key and the legacy
  // service-role JWT. Different hosts expose one name or the other.
  const SUPABASE_SERVER_KEY =
    process.env['SUPABASE_SECRET_KEY'] || process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!SUPABASE_SERVER_KEY) {
    throw new Error(
      'Chave privada do Supabase não configurada no servidor (SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY).',
    );
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVER_KEY, {
    global: { fetch: createSupabaseFetch(SUPABASE_SERVER_KEY) },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
