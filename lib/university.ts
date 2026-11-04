import { supabase } from '@/lib/supabase';

export type University = {
  id: string; name: string; short_name: string; time_zone: string;
  official_hosts: string[]; calendar_enabled: boolean;
};

// Server derives the campus from the confirmed Auth email, never a profile field.
export async function getCurrentUniversity(): Promise<University | null> {
  const { data, error } = await supabase.rpc('current_university');
  if (error) throw error;
  return (data?.[0] as University | undefined) ?? null;
}

// Optional signup hint only; mailbox verification and RLS remain authoritative.
export async function universityForEmail(email: string): Promise<{ id: string; name: string } | null> {
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const { data, error } = await supabase.from('university_email_domains')
    .select('university_id, universities(id,name)').eq('domain', parts[1]).maybeSingle();
  if (error) throw error;
  const university = data?.universities as unknown as { id: string; name: string } | null;
  return university ?? null;
}

export function officialUniversityLink(value: string, university: University | null): string | null {
  if (!university) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443')
      && university.official_hosts.includes(url.hostname.toLowerCase()) ? url.href : null;
  } catch { return null; }
}

/**
 * Resolves and validates a university name for a user profile.
 * - If the user has a verified campus email recognized by the system, that assigned university is authoritative.
 * - Otherwise, personal-email users can leave university blank or select a valid university
 *   from either the full university directory or the supported universities fallback table.
 */
export async function resolveProfileUniversity(requestedName: string): Promise<string> {
  let assigned: University | null = null;
  try {
    assigned = await getCurrentUniversity();
  } catch {
    // If the check fails or is unavailable, proceed to validate requestedName
  }
  if (assigned) {
    return assigned.name;
  }

  const trimmed = requestedName.trim();
  if (!trimmed) {
    return '';
  }

  // 1. Check the main university directory
  try {
    const { data: option, error: directoryError } = await supabase
      .from('university_directory')
      .select('name')
      .eq('name', trimmed)
      .maybeSingle();

    if (!directoryError && option?.name) {
      return option.name;
    }

    if (!directoryError) {
      const { data: ilikeOption, error: ilikeError } = await supabase
        .from('university_directory')
        .select('name')
        .ilike('name', trimmed)
        .maybeSingle();

      if (!ilikeError && ilikeOption?.name) {
        return ilikeOption.name;
      }
    }
  } catch {
    // university_directory table may not exist or query may fail; proceed to fallback
  }

  // 2. Check the fallback supported universities table
  try {
    const { data: fallback, error: fallbackError } = await supabase
      .from('universities')
      .select('name')
      .eq('name', trimmed)
      .maybeSingle();

    if (!fallbackError && fallback?.name) {
      return fallback.name;
    }

    const { data: fallbackIlike, error: fallbackIlikeError } = await supabase
      .from('universities')
      .select('name')
      .ilike('name', trimmed)
      .maybeSingle();

    if (!fallbackIlikeError && fallbackIlike?.name) {
      return fallbackIlike.name;
    }

    const { data: shortMatch, error: shortError } = await supabase
      .from('universities')
      .select('name')
      .ilike('short_name', trimmed)
      .maybeSingle();

    if (!shortError && shortMatch?.name) {
      return shortMatch.name;
    }
  } catch {
    // universities table query failed
  }

  throw new Error('Please select a university from the list.');
}
