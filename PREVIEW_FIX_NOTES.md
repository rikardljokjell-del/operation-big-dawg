Preview v2 fix notes (2026-08-17)

- Replaces gameplay-actions-preview.js with gameplay-actions-preview-v2.js.
- Removes the self-triggering body MutationObserver render loop that froze the app.
- Wild catch readiness is restored from server state via wild-ready-preview, not only transient browser events.
- Gym preview credit baseline was reset at 2026-08-17T13:33:00Z so the failed test run does not carry stale attack credits forward.
- Production/main remains untouched.
