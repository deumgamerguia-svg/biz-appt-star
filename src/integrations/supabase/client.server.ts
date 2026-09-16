// Server-side Supabase client with a privileged key. Keep this module server-only.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const CONNECTED_PROJECT_URL = 'https://qagotnmdqjoodoudcikd.supabase.co';

function isOpaqueSupabaseKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

/**
 * Supabase's new sb_secret_/sb_publishable_ keys are opaque API keys, not JWTs.
 * They must be sent as apikey and must not be reused as a Bearer token.
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
  // Este repositório está ligado a um único projeto Supabase. Não permita que
  // variáveis VITE/SUPABASE de outro ambiente redirecionem os server functions
  // do Painel 1 para um banco diferente do usado pelo Painel 2.
  const SUPABASE_URL = CONNECTED_PROJECT_URL;

  // Aceita a chave secreta nova ou o JWT service-role legado.
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
