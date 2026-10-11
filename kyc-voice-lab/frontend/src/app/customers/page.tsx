"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, RotateCcw, ShieldAlert, Play, CheckCircle2, Copy, Check } from "lucide-react";
import { api } from "@/lib/api";
import { Customer } from "@/types";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const data = await api.getCustomers();
      setCustomers(data);
      if (data.length > 0 && !selectedCustomer) {
        setSelectedCustomer(data[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleReset = async () => {
    if (!confirm("Reset database to initial synthetic seed customers?")) return;
    try {
      setResetting(true);
      await api.resetDemoData();
      await fetchCustomers();
    } catch (e: any) {
      alert(`Reset failed: ${e.message}`);
    } finally {
      setResetting(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Users className="w-7 h-7 text-blue-400" />
            Synthetic Customer Directory
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Fictional ground-truth records used for deterministic spoken answer comparison.
          </p>
        </div>

        <button
          onClick={handleReset}
          disabled={resetting}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 self-start sm:self-auto transition"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${resetting ? "animate-spin" : ""}`} />
          Reset Seed Data
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer List Column */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
            Available Test Profiles ({customers.length})
          </h2>

          {loading ? (
            <div className="p-6 text-center text-sm text-slate-500">Loading synthetic profiles...</div>
          ) : (
            <div className="space-y-2">
              {customers.map((c) => {
                const isSelected = selectedCustomer?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCustomer(c)}
                    className={`p-4 rounded-xl cursor-pointer border transition ${
                      isSelected
                        ? "bg-blue-600/15 border-blue-500/50 shadow-md shadow-blue-500/10"
                        : "bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">{c.full_name}</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {c.id}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
                      <span>{c.city}</span>
                      <span className="font-mono text-slate-500">{c.account_reference}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Customer Details & Verification Launch */}
        <div className="lg:col-span-2">
          {selectedCustomer ? (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div>
                  <span className="text-xs font-mono text-blue-400">
                    Synthetic Customer Profile
                  </span>
                  <h3 className="text-2xl font-bold text-white mt-0.5">
                    {selectedCustomer.full_name}
                  </h3>
                  <div className="text-xs text-slate-400 mt-1">
                    ID: <code className="text-slate-300">{selectedCustomer.id}</code>
                  </div>
                </div>

                <Link
                  href={`/sessions/new?customerId=${selectedCustomer.id}`}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition self-start sm:self-auto"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Launch Call for this Customer
                </Link>
              </div>

              {/* Expected KYC Values Grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Expected KYC Field Values (Ground Truth)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "1. Full Legal Name", value: selectedCustomer.full_name, field: "name" },
                    { label: "2. Date of Birth", value: selectedCustomer.date_of_birth, field: "dob" },
                    { label: "3. Registered City", value: selectedCustomer.city, field: "city" },
                    { label: "4. Postal Code (PIN)", value: selectedCustomer.postal_code, field: "pin" },
                    { label: "5. Registered Email", value: selectedCustomer.email, field: "email" },
                    { label: "6. Account Reference", value: selectedCustomer.account_reference, field: "ref" },
                  ].map((item) => (
                    <div
                      key={item.field}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between group"
                    >
                      <div>
                        <span className="text-[11px] font-medium text-slate-400 block">
                          {item.label}
                        </span>
                        <span className="text-sm font-semibold text-slate-100 font-mono mt-0.5 block">
                          {item.value}
                        </span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(item.value, item.field)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition"
                        title="Copy to clipboard"
                      >
                        {copiedField === item.field ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Compliance Assurance Box */}
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  Prototype Synthetic Guardrails
                </div>
                <p>
                  These identities are generated for offline laboratory testing only. No real personal records, Aadhaar numbers, PAN cards, or live banking credentials are stored or processed.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
              Select a customer from the left to inspect ground-truth values.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
