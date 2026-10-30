import { supabase } from '@/lib/supabase';
import type { ReportDraft } from '@/types/reports';

// submit_report validates the target, blocks self-reports, and returns the existing report id if
// this user already has an open report on the same target (see 20261026120000_reports.sql).
export async function submitReport(draft: ReportDraft): Promise<string> {
  const { data, error } = await supabase.rpc('submit_report', {
    p_target_type: draft.targetType,
    p_target_id: draft.targetId,
    p_reason: draft.reason,
    p_details: draft.details.trim() || null,
  });
  if (error) throw error;
  return data as string;
}
