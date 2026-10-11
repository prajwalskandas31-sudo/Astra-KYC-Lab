"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Mic,
  Users,
  Play,
  RotateCcw,
  Timer,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { api } from "@/lib/api";
import { DashboardStats, Session } from "@/types";
import { formatSeconds, formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sData, sessData] = await Promise.all([
        api.getDashboardStats(),
        api.getSessions(),
      ]);
      setStats(sData);
      setRecentSessions(sessData.slice(0, 5));
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReset = async () => {
    if (!confirm("Reset all test sessions and restore synthetic customers?")) return;
    try {
      setResetting(true);
      await api.resetDemoData();
      setMessage("Database successfully reset to seed state.");
      await loadData();
      setTimeout(() => setMessage(null), 4000);
    } catch (e: any) {
      alert(`Reset failed: ${e.message}`);
    } finally {
      setResetting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> VERIFIED
          </span>
        );
      case "NEEDS_MANUAL_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-800">
            <AlertTriangle className="w-3 h-3" /> MANUAL REVIEW
          </span>
        );
      case "NOT_VERIFIED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950 text-rose-400 border border-rose-800">
            <XCircle className="w-3 h-3" /> NOT VERIFIED
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950 text-blue-400 border border-blue-800">
            <Activity className="w-3 h-3 animate-spin" /> IN PROGRESS
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <Clock className="w-3 h-3" /> INCOMPLETE
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              KYC Verification Dashboard
            </h1>
            <span className="px-2 py-0.5 text-[11px] font-mono bg-blue-950 border border-blue-800 text-blue-400 rounded-md">
              Local Prototype Test Data
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Automated English speech recognition, deterministic field matching, and audit trail analytics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Reset test sessions & restore initial synthetic customer data"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? "animate-spin" : ""}`} />
            Reset Prototype Data
          </button>
          <Link
            href="/sessions/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Launch Verification Call
          </Link>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {message}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Sessions */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Total</span>
            <FileText className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {stats ? stats.total_sessions : "—"}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">Sessions recorded</div>
        </div>

        {/* Verified */}
        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-medium uppercase tracking-wider">Verified</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">
            {stats ? stats.completed_sessions : "—"}
          </div>
          <div className="text-[11px] text-emerald-500/70 mt-1 font-mono">All fields passed</div>
        </div>

        {/* Manual Review */}
        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-xs font-medium uppercase tracking-wider">Review</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-400">
            {stats ? stats.manual_review_sessions : "—"}
          </div>
          <div className="text-[11px] text-amber-500/70 mt-1 font-mono">Ambiguous answers</div>
        </div>

        {/* Not Verified */}
        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-400">
            <span className="text-xs font-medium uppercase tracking-wider">Mismatch</span>
            <XCircle className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-400">
            {stats ? stats.not_verified_sessions : "—"}
          </div>
          <div className="text-[11px] text-rose-500/70 mt-1 font-mono">Verification failed</div>
        </div>

        {/* Incomplete */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Incomplete</span>
            <Clock className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-300">
            {stats ? stats.incomplete_sessions : "—"}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">Cancelled / partial</div>
        </div>

        {/* Avg Transcription Latency */}
        <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-400">
            <span className="text-xs font-medium uppercase tracking-wider">STT Latency</span>
            <Timer className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-300">
            {stats && stats.avg_transcription_time
              ? formatSeconds(stats.avg_transcription_time)
              : "Unmeasured"}
          </div>
          <div className="text-[11px] text-blue-500/70 mt-1 font-mono">faster-whisper CPU</div>
        </div>
      </div>

      {/* Quick Launch & Flow Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-900/30 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
              <Mic className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Simulate Verification Call</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Step through the 6-question English questionnaire with browser microphone recording. FastAPI transcribes speech locally using <code className="text-blue-300">faster-whisper (base.en)</code> on CPU.
            </p>
          </div>
          <div className="mt-6">
            <Link
              href="/sessions/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition"
            >
              Start New Test Call →
            </Link>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-900/30 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Synthetic Customer Records</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Inspect expected customer attributes (Name, DOB, City, PIN, Email, Account Ref) for 5 fictional customers. Zero real personal identity documents used.
            </p>
          </div>
          <div className="mt-6">
            <Link
              href="/customers"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              Browse Customers →
            </Link>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Deterministic Rules Engine</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Speech is evaluated against exact ground-truth values using strict normalisation rules. No fuzzy matching is allowed to falsely approve identities.
            </p>
          </div>
          <div className="mt-6">
            <Link
              href="/sessions"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              View Past Audits →
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Sessions List */}
      <div className="rounded-2xl bg-slate-900/50 border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Recent Test Sessions</h2>
          <Link
            href="/sessions"
            className="text-xs text-blue-400 hover:text-blue-300 font-medium"
          >
            View all ({recentSessions.length}) →
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading session history...</div>
        ) : recentSessions.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No test sessions recorded yet. Click &ldquo;Launch Verification Call&rdquo; to begin.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {recentSessions.map((s) => (
              <div
                key={s.id}
                className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white font-mono">
                        {s.id.slice(0, 8)}...
                      </span>
                      {getStatusBadge(s.status)}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Customer ID: <code className="text-slate-300">{s.customer_id}</code> • Started {formatDate(s.started_at)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-400 font-mono">
                    Duration: {formatSeconds(s.total_duration_seconds)}
                  </span>
                  <Link
                    href={`/results/${s.id}`}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700"
                  >
                    Audit Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
