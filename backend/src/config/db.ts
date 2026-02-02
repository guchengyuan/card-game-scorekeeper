import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch, { Headers, Request, Response } from 'node-fetch';

// Polyfill for Node.js environments (older than v18)
if (!global.fetch) {
  (global as any).fetch = fetch;
  (global as any).Headers = Headers;
  (global as any).Request = Request;
  (global as any).Response = Response;
}

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});
