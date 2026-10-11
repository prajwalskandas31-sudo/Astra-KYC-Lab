export type SessionStatus =
  | "IN_PROGRESS"
  | "VERIFIED"
  | "NEEDS_MANUAL_REVIEW"
  | "NOT_VERIFIED"
  | "INCOMPLETE";

export type VerificationOutcome =
  | "MATCH"
  | "MISMATCH"
  | "NEEDS_CLARIFICATION"
  | "NOT_PROVIDED"
  | "NOT_APPLICABLE";

export type QuestionType = "YES_NO" | "OPEN";

export interface Customer {
  id: string;
  full_name: string;
  date_of_birth: string;
  city: string;
  postal_code: string;
  email: string;
  account_reference: string;
  created_at: string;
}

export interface Question {
  index: number;
  field: string;
  type: QuestionType;
  prompt_text: string;
}

export interface Session {
  id: string;
  customer_id: string;
  status: SessionStatus;
  started_at: string;
  completed_at: string | null;
  total_duration_seconds: number | null;
  current_question_index: number;
}

export interface SessionWithCustomer extends Session {
  customer: Customer;
}

export interface AnswerAttempt {
  id: string;
  session_id: string;
  question_index: number;
  question_field: string;
  question_type: QuestionType;
  attempt_number: number;
  transcript: string | null;
  normalised_answer: string | null;
  expected_value: string | null;
  outcome: VerificationOutcome | null;
  outcome_reason: string | null;
  needs_manual_review: boolean;
  audio_duration_seconds: number | null;
  transcription_duration_seconds: number | null;
  verification_duration_seconds: number | null;
  total_processing_seconds: number | null;
  created_at: string;
}

export interface FieldVerificationResult {
  field_name: string;
  expected_value: string;
  original_transcript: string;
  normalised_answer: string;
  outcome: VerificationOutcome;
  reason: string;
  needs_manual_review: boolean;
}

export interface SessionResult {
  session_id: string;
  customer_id: string;
  customer_name: string;
  status: SessionStatus;
  started_at: string;
  completed_at: string | null;
  total_duration_seconds: number | null;
  answers: AnswerAttempt[];
  field_results: FieldVerificationResult[];
}

export interface DashboardStats {
  total_sessions: number;
  completed_sessions: number;
  manual_review_sessions: number;
  not_verified_sessions: number;
  incomplete_sessions: number;
  in_progress_sessions: number;
  avg_transcription_time: number | null;
}

export interface HealthCheck {
  status: string;
  speech_model_loaded: boolean;
  ffmpeg_available: boolean;
  database_ok: boolean;
}
