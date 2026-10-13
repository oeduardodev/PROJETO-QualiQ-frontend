import { Injectable } from '@angular/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppDatabase } from '@core/models/database';

declare global {
  interface Window {
    __env?: Record<string, string>;
  }
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client = this.createClient();

  private createClient(): SupabaseClient<AppDatabase> {
    const environment = window.__env ?? {};
    const url = environment['VITE_SUPABASE_URL'] ?? '';
    const publicKey = environment['VITE_SUPABASE_ANON_KEY'] ?? '';

    if (!url || !publicKey)
      console.warn('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.');

    return createClient<AppDatabase>(
      url || 'https://example.supabase.co',
      publicKey || 'missing-anon-key',
    );
  }
}
