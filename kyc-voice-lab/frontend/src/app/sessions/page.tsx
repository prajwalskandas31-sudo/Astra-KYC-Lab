"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  History,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Activity,
  ArrowRight,
  Filter,
} from "lucide-react";
import { api } from "@/lib/api";
import { Session, SessionStatus } from "@/types";
import { formatDate, formatSeconds } from "@/lib/utils";

export default function SessionsHistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");

  useEffect(() => {
    api
      .getSessions()
      .then((data) => setSessions(data))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const getStatusBadge = (status: SessionStatus) => {
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

  const filteredSessions = sessions.filter((s) => {
    if (filter === "ALL") return true;
    return s.status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <History className="w-7 h-7 text-blue-400" />
            Verification Session History
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Browse and review past KYC verification test sessions and audit trails.
          </p>
        </div>

        <Link
          href="/sessions/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition self-start sm:self-auto"
        >
          <Play className="w-4 h-4 fill-current" />
          Launch New Call
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-medium">
        {["ALL", "VERIFIED", "NEEDS_MANUAL_REVIEW", "NOT_VERIFIED", "IN_PROGRESS", "INCOMPLETE"].map(
          (statusKey) => (
            <button
              key={statusKey}
              onClick={() => setFilter(statusKey)}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                filter === statusKey
                  ? "bg-blue-600 text-white font-bold"
                  : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800"
              }`}
            >
              {statusKey.replace(/_/g, " ")}
            </button>
          )
        )}
      </div>

      {/* Sessions Table */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading sessions...</div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No verification sessions found matching filter &quot;{filter}&quot;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Session ID</th>
                  <th className="px-6 py-3.5">Customer ID</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Started</th>
                  <th className="px-6 py-3.5">Completed</th>
                  <th className="px-6 py-3.5">Duration</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredSessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4 font-mono font-bold text-white">
                      {s.id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-300">
                      {s.customer_id}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(s.status)}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-400">
                      {formatDate(s.started_at)}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-400">
                      {formatDate(s.completed_at)}
                    </td>
                    <td className="px-6 py-4 font-mono">
                      {formatSeconds(s.total_duration_seconds)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/results/${s.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 font-semibold border border-slate-700 transition"
                      >
                        Audit Trail <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
