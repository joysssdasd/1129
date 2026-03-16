# Edge Functions Baseline

This project now uses `edge-functions.manifest.json` as the source of truth for edge function ownership:

- `source: "repo"` means function code should exist under `supabase/functions/<name>/`.
- `source: "external"` means function is invoked by frontend but managed outside this repository.

## Validation

Run:

```bash
pnpm check:edge-functions
```

The check validates:

1. All frontend `functions.invoke()` names are declared in the manifest.
2. All manifest functions with `source: "repo"` have local implementation folders.
3. All local function folders are represented in the manifest.

Warnings are emitted when a function is invoked with query parameters embedded in function name.
