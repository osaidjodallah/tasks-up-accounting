import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xdrfaxcyoczaqbrfjqqr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NpYWyMWt8wLhPYlRDhXZIQ_oiqysGwy';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Get value from Supabase table 'app_store' by key
 * @param {string} key 
 * @returns {Promise<any>}
 */
export async function supabaseGet(key) {
  try {
    const { data, error } = await supabase
      .from('app_store')
      .select('value')
      .eq('key', key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Record not found
        return null;
      }
      console.error(`Error reading key ${key} from Supabase:`, error);
      return null;
    }
    return data?.value ?? null;
  } catch (err) {
    console.error(`Unexpected error reading key ${key}:`, err);
    return null;
  }
}

/**
 * Set value in Supabase table 'app_store' by key
 * @param {string} key 
 * @param {any} value 
 */
export async function supabaseSet(key, value) {
  try {
    const { error } = await supabase
      .from('app_store')
      .upsert({ 
        key, 
        value, 
        updated_at: new Date().toISOString() 
      });

    if (error) {
      console.error(`Error writing key ${key} to Supabase:`, error);
    }
  } catch (err) {
    console.error(`Unexpected error writing key ${key}:`, err);
  }
}
