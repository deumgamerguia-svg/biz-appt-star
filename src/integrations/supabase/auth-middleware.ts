// Server auth middleware. Mantém o backend no mesmo projeto Supabase do frontend.
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const CONNECTED_PROJECT_URL = 'https://qagotnmdqjoodoudcikd.supabase.co';
const CONNECTED_PUBLISHABLE_KEY = 'sb_publishable_ahOK_X2idzT_9V00g-guZQ_FZ_eScZj';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const prefix = `${name}=`;
  for (const part of cookieHeader.split(';')) {
    const value = part.trim();
    if (value.startsWith(prefix)) {
      try {
        return decodeURIComponent(value.slice(prefix.length));
      } catch {
        return value.slice(prefix.length);
      }
    }
  }
  return null;
}

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env['VITE_SUPABASE_URL'] || CONNECTED_PROJECT_URL;
    const SUPABASE_PUBLISHABLE_KEY =
      process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] || CONNECTED_PUBLISHABLE_KEY;

    const request = getRequest();
    if (!request?.headers) {
      throw new Error('Unauthorized: No request headers available');
    }

    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : null;
    const cookieToken = readCookie(request.headers.get('cookie'), 'agenda_supabase_session');

    const token = headerToken && headerToken.split('.').length === 3
      ? headerToken
      : cookieToken;

    if (!token) {
      throw new Error('Unauthorized: Supabase session not available');
    }

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: {
        fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new Error('Unauthorized: Invalid Supabase session');
    }

    return next({
      context: {
        supabase,
        userId: data.user.id,
        claims: {
          sub: data.user.id,
          email: data.user.email,
          role: data.user.role,
        },
      },
    });
  },
);
