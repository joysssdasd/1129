# WeChat Market Automation

This workflow turns EchoTrace WeChat data into NiuNiu market reports, managed platform posts, and 6-hour market summaries.

## Current Pipeline

1. `scripts/wechat-market-auto.mjs` calls EchoTrace's command-line exporter from `C:\Users\big\Downloads\echotrace-windows-v3.1.0\echotrace.exe` and writes JSON into `wechat/auto-import/echotrace-cli/{date-hour}`.
2. It also reads EchoTrace decrypted databases under `wechat/EchoTrace/` directly, exporting text messages into `wechat/auto-import/echotrace-db/{date-hour}`.
3. `scripts/wechat-market-daily.mjs` reads `wechat/`, extracts high-confidence market signals, writes reports under `cc/`, and builds a managed sync manifest.
4. Each run is copied into an immutable snapshot under `cc/generated/runs/{runId}/`, so a later empty 6-hour window does not erase earlier run data.
5. In publish mode, the script calls the local `functions/api/[[path]].js` handler by default to create/update/refresh/deactivate managed market posts through Supabase service-role access.
6. `scripts/wechat-market-summary.mjs` writes a human-readable 6-hour market summary and supports manual keyword/category queries.

## Commands

Preview without publishing:

```powershell
pnpm run wechat:auto -- --since-hours=6
```

Preview extraction only when the upload network is unavailable:

```powershell
pnpm run wechat:auto -- --offline --since-hours=6
```

Generate the latest market summary:

```powershell
pnpm run wechat:summary -- --since-hours=6
```

Manually query a specific market:

```powershell
pnpm run wechat:query -- --query="iPhone16" --since-hours=6 --limit=10
pnpm run wechat:query -- --board="演唱会" --city="深圳" --intent=sell --limit=10
```

Query a specific saved run snapshot:

```powershell
pnpm run wechat:query -- --generated-dir="E:\claude15\cc\generated\runs\RUN_ID" --query="iPhone16" --limit=10
```

Publish to the site:

```powershell
pnpm run wechat:auto-publish -- --since-hours=6
```

Use a deployed HTTP API instead of the local handler:

```powershell
pnpm run wechat:auto-publish -- --sync=http --site="https://your-pages-function-domain" --since-hours=6
```

Use a separate EchoTrace export folder:

```powershell
pnpm run wechat:auto-publish -- --source-dir="C:\path\to\echotrace-json-export" --since-hours=6
```

Skip direct database reading and only process existing JSON files:

```powershell
pnpm run wechat:auto-publish -- --skip-db --since-hours=6
```

Skip EchoTrace CLI export and only use the decrypted database/JSON files:

```powershell
pnpm run wechat:auto-publish -- --skip-echotrace --since-hours=6
```

Install a Windows scheduled task that runs every 6 hours:

```powershell
pnpm run wechat:install-task -- -Mode publish -EveryHours 6 -SinceHours 6
```

## Outputs

- Latest run state: `cc/generated/wechat-market-automation-state.json`
- Per-run logs: `cc/generated/automation-logs/*.json`
- Daily generated files: `cc/generated/{date}/`
- Per-run generated snapshots: `cc/generated/runs/{runId}/`
- Draft/final reports: `cc/reports/drafts/` and `cc/reports/final/`
- Automatic 6-hour summaries: `cc/summaries/auto/{date}/*-summary-{window}.md`
- Manual query summaries: `cc/summaries/manual/{date}/*-query-*.md`
- Latest summary shortcuts: `cc/summaries/latest-auto-summary.md` and `cc/summaries/latest-manual-summary.md`

## Notes

- The automation defaults to the workspace `wechat/` folder.
- EchoTrace CLI export defaults to `C:\Users\big\Downloads\echotrace-windows-v3.1.0\echotrace.exe`; override it with `--echotrace-exe="C:\path\to\echotrace.exe"`.
- Direct database reading defaults to `wechat/EchoTrace/`, including account folders such as `wxid_yq70a2dy8yg922`.
- The sync target defaults to `local`, which means it imports the repo's Pages Function handler and does not depend on `niuniubase.top/api` being deployed.
- `--since-hours=6` limits processing to recently exported messages when message timestamps are present.
- The script supports JSON files directly under `wechat/` and in nested export folders.
- EchoTrace database direct-read maps `Msg_{md5(username)}` session tables, resolves sender names from `Name2Id`/`contact.db`, and decompresses zstd message bodies with Node's built-in zlib support.
- The scheduled automation creates a summary after each successful run. Use `--skip-summary` only when you want upload/extraction without writing summary files.
