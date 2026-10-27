import type { ReportDraft } from '@/types/reports';

// Not wired to the database yet. Once supabase/migrations/20261026120000_reports.sql is applied,
// replace the body with:
//   const { error } = await supabase.rpc('submit_report', {
//     p_target_type: draft.targetType,
//     p_target_id: draft.targetId,
//     p_reason: draft.reason,
//     p_details: draft.details.trim() || null,
//   });
//   if (error) throw error;
export async function submitReport(draft: ReportDraft): Promise<void> {
  if (__DEV__) console.log('[reports] submit (not persisted yet):', draft);
}
