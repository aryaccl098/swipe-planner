// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jgmeakscmjwknhwzxtjd.supabase.co';        // ← 替换
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnbWVha3NjbWp3a25od3p4dGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NDU4NjksImV4cCI6MjA3NzAyMTg2OX0.62Y8T_QLEhe1U4Aze79EfaIqoUzbzdCODUVket9GR0g';               // ← 替换

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
