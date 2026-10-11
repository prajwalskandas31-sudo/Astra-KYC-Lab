"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mic, ArrowRight, ShieldCheck, UserCheck, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Customer } from "@/types";

function SessionLauncherContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get("customerId");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getCustomers()
      .then((data) => {
        setCustomers(data);
        if (preselectedId && data.some((c) => c.id === preselectedId)) {
          setSelectedCustomerId(preselectedId);
        } else if (data.length > 0) {
          setSelectedCustomerId(data[0].id);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [preselectedId]);

  const handleStart = async () => {
    if (!selectedCustomerId) return;
    try {
      setStarting(true);
      setError(null);
      const session = await api.createSession(selectedCustomerId);
      router.push(`/sessions/${session.id}`);
    } catch (e: any) {
      setError(e.message || "Failed to create verification session.");
      setStarting(false);
    }
  };

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto shadow-lg shadow-blue-500/10">
          <Mic className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-extrabold text-white">Start Verification Session</h1>
        <p className="text-sm text-slate-400">
          Select a synthetic customer profile to begin the interactive 6-question English verification call.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/50 border border-rose-800 rounded-xl text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            Select Customer
          </label>
          {loading ? (
            <div className="text-sm text-slate-500">Loading customers...</div>
          ) : (
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.id}) — {c.city}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedCustomer && (
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
              <UserCheck className="w-4 h-4" />
              Customer KYC Baseline Summary
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500">Full Name:</span>{" "}
                <strong className="text-slate-200">{selectedCustomer.full_name}</strong>
              </div>
              <div>
                <span className="text-slate-500">Date of Birth:</span>{" "}
                <strong className="text-slate-200">{selectedCustomer.date_of_birth}</strong>
              </div>
              <div>
                <span className="text-slate-500">City:</span>{" "}
                <strong className="text-slate-200">{selectedCustomer.city}</strong>
              </div>
              <div>
                <span className="text-slate-500">PIN Code:</span>{" "}
                <strong className="text-slate-200">{selectedCustomer.postal_code}</strong>
              </div>
              <div>
                <span className="text-slate-500">Email:</span>{" "}
                <strong className="text-slate-200">{selectedCustomer.email}</strong>
              </div>
              <div>
                <span className="text-slate-500">Account Ref:</span>{" "}
                <strong className="text-slate-200">{selectedCustomer.account_reference}</strong>
              </div>
            </div>
          </div>
        )}

        <div className="pt-2">
          <button
            onClick={handleStart}
            disabled={starting || !selectedCustomerId}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-lg shadow-blue-600/30 transition"
          >
            {starting ? "Initializing Session..." : "Begin Simulated Call"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NewSessionPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading launcher...</div>}>
      <SessionLauncherContent />
    </Suspense>
  );
}
