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
