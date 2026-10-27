// Mirrors the report_target_type / report_reason enums in supabase/migrations/20261026120000_reports.sql.
export type ReportTargetType = 'user' | 'activity' | 'post';

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'nudity'
  | 'violence'
  | 'false_information'
  | 'impersonation'
  | 'scam'
  | 'other';

export type ReportReasonOption = {
  value: ReportReason;
  label: string;
};

export type ReportDraft = {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details: string;
};

export const REPORT_TARGET_LABELS: Record<ReportTargetType, string> = {
  user: 'User',
  activity: 'Activity',
  post: 'Post',
};

// Not every reason fits every target: an activity can't be impersonation, a photo can't be a scam listing.
export const REPORT_REASONS: Record<ReportTargetType, ReportReasonOption[]> = {
  user: [
    { value: 'harassment', label: 'Harassment or bullying' },
    { value: 'impersonation', label: 'Pretending to be someone else' },
    { value: 'spam', label: 'Spam or fake account' },
    { value: 'hate_speech', label: 'Hate speech or symbols' },
    { value: 'scam', label: 'Scam or fraud' },
    { value: 'other', label: 'Something else' },
  ],
  activity: [
    { value: 'false_information', label: 'Misleading or fake activity' },
    { value: 'scam', label: 'Scam or fraud' },
    { value: 'violence', label: 'Dangerous or violent activity' },
    { value: 'hate_speech', label: 'Hate speech or symbols' },
    { value: 'spam', label: 'Spam' },
    { value: 'other', label: 'Something else' },
  ],
  post: [
    { value: 'nudity', label: 'Nudity or sexual content' },
    { value: 'violence', label: 'Violence or graphic content' },
    { value: 'harassment', label: 'Harassment or bullying' },
    { value: 'hate_speech', label: 'Hate speech or symbols' },
    { value: 'spam', label: 'Spam' },
    { value: 'other', label: 'Something else' },
  ],
};

export const REPORT_DETAILS_MAX_LENGTH = 1000;
