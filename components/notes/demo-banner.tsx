// Demo-mode notice while anonymous database access is on (see docs/ARCHITECTURE.md
// section 5). Delete this file and its use in notes-app.tsx with the TEMP policies.
export const DEMO_NOTICE =
  "Demo mode: this data is publicly accessible. Don't store private notes.";

export function DemoBanner() {
  return (
    <div
      role="note"
      className="border-b bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200"
    >
      {DEMO_NOTICE}
    </div>
  );
}
