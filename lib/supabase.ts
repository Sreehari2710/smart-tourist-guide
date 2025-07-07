// lib/supabase.ts
// This file sets up the Supabase client for your Next.js application.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get Supabase URL and Anon Key from environment variables.
// These are loaded from the .env.local file.
const supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if environment variables are defined.
if (!supabaseUrl || !supabaseAnonKey) {
  // Use console.error for critical configuration issues.
  console.error("Supabase URL or Anon Key is missing. Please check your .env.local file.");
  // In a production environment, you might want to throw an error or exit the process.
  // For development, we'll proceed, but the client might not work.
}

// Create and export the Supabase client instance.
// Provide the type hint for better type inference.
export const supabase: SupabaseClient = createClient(
  supabaseUrl as string, // Cast to string as we've checked for undefined above
  supabaseAnonKey as string // Cast to string
);
