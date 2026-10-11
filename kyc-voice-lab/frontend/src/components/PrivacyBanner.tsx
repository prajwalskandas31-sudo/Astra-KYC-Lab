import { ShieldAlert } from "lucide-react";

export default function PrivacyBanner() {
  return (
    <div className="bg-amber-950/40 border-b border-amber-800/40 px-4 py-2 text-xs text-amber-300 flex items-center justify-center gap-2 text-center">
      <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
      <span>
        <strong>Privacy Notice:</strong> Audio recordings can contain spoken personal identifiers. This prototype operates exclusively in offline/local-first mode on localhost with synthetic test data. Do not upload real Aadhaar, PAN, or sensitive identity documents.
      </span>
    </div>
  );
}
