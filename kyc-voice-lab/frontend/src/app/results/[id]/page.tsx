"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Download,
  RotateCcw,
  User,
  ArrowLeft,
  FileSpreadsheet,
  FileJson,
  Timer,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { SessionResult, VerificationOutcome, SessionStatus } from "@/types";
import { formatDate, formatSeconds } from "@/lib/utils";

export default function SessionResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [result, setResult] = useState<SessionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      api
        .getSessionResults(sessionId)
        .then((data) => setResult(data))
        .catch((e) => setError(e.message || "Failed to load session audit."))
        .finally(() => setLoading(false));
    }
  }, [sessionId]);

  const handleExportJson = () => {
    if (!result) return;
    // Section 12: Exclude audio from JSON export by default
    const exportData = {
      audit_export_version: "1.0",
      generated_at: new Date().toISOString(),
      disclaimer: "Local prototype test data. No real personal records.",
      session_id: result.session_id,
      customer_id: result.customer_id,
      customer_name: result.customer_name,
      final_status: result.status,
      started_at: result.started_at,
      completed_at: result.completed_at,
      total_duration_seconds: result.total_duration_seconds,
      field_verifications: result.field_results,
      answer_attempts: result.answers.map((a) => ({
        question_index: a.question_index,
        field: a.question_field,
        type: a.question_type,
        attempt: a.attempt_number,
        transcript: a.transcript,
        normalised_answer: a.normalised_answer,
        outcome: a.outcome,
        reason: a.outcome_reason,
        manual_review: a.needs_manual_review,
        stt_latency_seconds: a.transcription_duration_seconds,
        total_latency_seconds: a.total_processing_seconds,
        timestamp: a.created_at,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kyc_audit_${result.session_id.slice(0, 8)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: SessionStatus) => {
    switch (status) {
      case "VERIFIED":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-300 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            STATUS: VERIFIED
          </div>
        );
      case "NEEDS_MANUAL_REVIEW":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-950/80 border border-amber-700 text-amber-300 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            STATUS: NEEDS MANUAL REVIEW
          </div>
        );
      case "NOT_VERIFIED":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-300 font-bold text-sm">
            <XCircle className="w-4 h-4 text-rose-400" />
            STATUS: NOT VERIFIED
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-bold text-sm">
            <Clock className="w-4 h-4 text-slate-400" />
            STATUS: {status}
          </div>
        );
    }
  };

  const getOutcomeBadge = (outcome: VerificationOutcome) => {
    switch (outcome) {
      case "MATCH":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> MATCH
          </span>
        );
      case "MISMATCH":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-rose-950 text-rose-400 border border-rose-800">
            <XCircle className="w-3 h-3" /> MISMATCH
          </span>
        );
      case "NEEDS_CLARIFICATION":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-800">
            <AlertTriangle className="w-3 h-3" /> CLARIFICATION
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            {outcome}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center space-y-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
        <p className="text-slate-400 text-sm">Compiling audit trail results...</p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="p-8 max-w-lg mx-auto bg-rose-950/40 border border-rose-800 rounded-2xl text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Results Unavailable</h2>
        <p className="text-sm text-rose-300">{error || "Audit could not be located."}</p>
        <Link
          href="/sessions"
          className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
        >
          View All Sessions
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href="/sessions"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              Verification Audit Report
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Session ID: {result.session_id}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportJson}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Export Audit JSON
          </button>
          <Link
            href={`/sessions/${result.session_id}`}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reopen Session
          </Link>
        </div>
      </div>

      {/* Session Overview Card */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
        <div>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
            Customer Profile
          </span>
          <span className="text-lg font-bold text-white block mt-1">
            {result.customer_name}
          </span>
          <span className="text-xs font-mono text-slate-500 block">
            ID: {result.customer_id}
          </span>
        </div>

        <div>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
            Call Timestamps
          </span>
          <span className="text-xs text-slate-300 block mt-1 font-mono">
            Started: {formatDate(result.started_at)}
          </span>
          <span className="text-xs text-slate-400 block font-mono">
            Finished: {formatDate(result.completed_at)}
          </span>
        </div>

        <div>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
            Total Elapsed Time
          </span>
          <span className="text-lg font-bold text-slate-200 font-mono block mt-1">
            {formatSeconds(result.total_duration_seconds)}
          </span>
          <span className="text-[11px] text-slate-500 block">End-to-end duration</span>
        </div>

        <div className="flex md:justify-end">
          {getStatusBadge(result.status)}
        </div>
      </div>

      {/* Field-by-Field Ground-Truth Comparison Table */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden space-y-0">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Deterministic Field Verification Matrix
          </h2>
          <span className="text-xs text-slate-400">
            {result.field_results.length} fields evaluated
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Field</th>
                <th className="px-6 py-3.5">Expected (Ground Truth)</th>
                <th className="px-6 py-3.5">Recognised Transcript</th>
                <th className="px-6 py-3.5">Normalised Value</th>
                <th className="px-6 py-3.5">Outcome</th>
                <th className="px-6 py-3.5">Verdict Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {result.field_results.map((field) => (
                <tr key={field.field_name} className="hover:bg-slate-800/30 transition">
                  <td className="px-6 py-4 font-bold text-white font-mono">
                    {field.field_name}
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-300">
                    {field.expected_value}
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-200 max-w-xs truncate" title={field.original_transcript}>
                    {field.original_transcript || <em className="text-slate-600">None</em>}
                  </td>
                  <td className="px-6 py-4 font-mono text-blue-300">
                    {field.normalised_answer || <em className="text-slate-600">—</em>}
                  </td>
                  <td className="px-6 py-4">
                    {getOutcomeBadge(field.outcome)}
                  </td>
                  <td className="px-6 py-4 text-slate-400 max-w-xs">
                    {field.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Complete Answer Attempts & Latency Audit Trail */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden space-y-0">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            All Spoken Answer Attempts & Processing Durations
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {result.answers.length} attempt(s) recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/60 text-slate-400 uppercase border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Q#</th>
                <th className="px-6 py-3">Field</th>
                <th className="px-6 py-3">Attempt</th>
                <th className="px-6 py-3">Spoken Transcript</th>
                <th className="px-6 py-3">Audio Sec</th>
                <th className="px-6 py-3">STT Sec</th>
                <th className="px-6 py-3">Total Sec</th>
                <th className="px-6 py-3">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {result.answers.map((ans) => (
                <tr key={ans.id} className="hover:bg-slate-800/30">
                  <td className="px-6 py-3 font-bold text-white">Q{ans.question_index + 1}</td>
                  <td className="px-6 py-3">{ans.question_field}</td>
                  <td className="px-6 py-3">#{ans.attempt_number}</td>
                  <td className="px-6 py-3 text-slate-100 max-w-xs truncate" title={ans.transcript || ""}>
                    {ans.transcript || "(silence)"}
                  </td>
                  <td className="px-6 py-3">{formatSeconds(ans.audio_duration_seconds)}</td>
                  <td className="px-6 py-3 text-blue-400">{formatSeconds(ans.transcription_duration_seconds)}</td>
                  <td className="px-6 py-3">{formatSeconds(ans.total_processing_seconds)}</td>
                  <td className="px-6 py-3">
                    {ans.outcome ? getOutcomeBadge(ans.outcome) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
