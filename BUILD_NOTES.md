# Token Radar — build notes

Entry for make.fun's **"Build the best token launch radar"** (`token-radar-01`, $1,325 USDC in on-chain escrow, ends Mon 14 Dec 2026 10:00 UTC). Built in this session; **not registered, not submitted**.

## What it is

`main.ts` (Node 22, standard library only) reads a sealed DefiLlama snapshot, scores every pre-token protocol with the radar-2 model in `lib/model.ts`, and writes:

- `board.json` — the ranked board
- `data.js` — the same board for the dashboard
- `dashboard/` — the static page (index.html + app.css + app.js, no network)
- `screenshots/` — the three screenshots
- `dossier.json` — built with the kit's vendored `vendor/makefun-board.ts` (byte-for-byte copy from the kit)

## The model (radar-3)

**Who counts as pre-token** — the sealed watchlist's own rule, applied to every protocol:

- records no token: market cap, CoinGecko id and symbol are all null;
- not a wrapped/staked product: category is not Bridge, Canonical Bridge, Cross Chain Bridge, Liquid Staking, Liquid Restaking, Restaked BTC or CEX; the name has no whole word `wrapped`/`staked`/`staking`, does not end in a version marker (`V2`, `v3`, `2.0`) and does not begin with a centralised-exchange brand.

**Implied value** — from the snapshot's own figures only, every number fitted from the snapshot's 119 live-token protocols:

```
implied = TVL x category_multiple
        x (TVL / typical_TVL) ^ -0.33
        x (1 + clamp(change_7d, -50, 100) / 100 x 0.25)
        x (0.90 + min(age_days, 1460) / 1460 x 0.10)
```

`category_multiple` is the geometric blend of the category's median market-cap-to-TVL ratio and the global median (0.246x), weighted n/(n+5) by the category's live count; `typical_TVL` is the median TVL of the category's live protocols; the size tilt is clamped to 0.25–4.00x and every multiple to 0.05–0.75x. No protocol name is special-cased. The dashboard recomputes every row from the same figures and checks it against board.json — the detail view prints "Page recomputes $X — matches board.json."

**What the data said.** Measured on the 119 live protocols before changing anything: within a category, size is the one strong signal for the multiple (slope −0.33, t = −2.6); 7-day growth (t = +0.2), chain count (t = −0.3) and age (t = −0.1) carry none. So radar-3 keeps the size tilt, shrinks the growth weight from 0.75 to 0.25, drops the chain bonus, and flattens maturity from 0.70–1.00 to 0.90–1.00. Each change was kept only because it raised the measured score (see below); the chain bonus and the old maturity curve were dropped because they did not.

**How it was checked.** The model's job is to price a token that does not exist yet, and the snapshot's live protocols are the only ground truth: 5-fold cross-validation, fit on four folds, predict the held-out fold's market caps, reshuffled 10 times (same folds and metrics for every candidate):

| model | median abs. % error | median \|log10 error\| | Spearman | within 2× |
|---|---|---|---|---|
| radar-2 (flat median, growth 0.75, chain +4%, maturity 0.70–1.00) | 92.3% | 0.723 | 0.370 | 23.9% |
| radar-3 (shrunk multiple, fitted size tilt, growth 0.25, no chains, maturity 0.90–1.00) | 88.4% | 0.598 | 0.364 | 29.1% |

Same-seed direct comparison (seed 20261116, shipped functions): radar-2 93.9% / 0.744 / 0.357 / 21.8% vs radar-3 89.2% / 0.565 / 0.348 / 29.4%. The Spearman dip (−0.01) is inside the noise (sd ±0.03 across reshuffles); the log-error and within-2× gains are not.

**Farm plan** — 7 steps per protocol, derived from its own record: category decides the action, TVL decides the capital ($50–$250), age decides the hold (30–60 days). First step is wallet hygiene, last is claim safety.

## Numbers (snapshot 2026-11-14)

- 758 protocols in the snapshot; 40 on the watchlist; 342 record no token
- Board: **197 rows** (40 watchlist + 157 found below the $50M floor), all 40 watchlist slugs covered
- Total implied value: **$2,738,731,387**; top launch Sentora Curator $239.8M; last row Nucleus $1,208,193
- All 197 implied values are distinct; every farm plan is 7 steps of 99–209 characters
- Live-token view: top 50 live protocols + a 33-category multiples table (blend weight and typical TVL per category)
- Dashboard source: 35,061 bytes total (dossier text 35,325 bytes, cap 65,536); dossier 734,715 bytes (cap 1.5 MiB); no `http` references anywhere in it

## How to run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

Node 24.22.1 was used here (requirement: ≥ 22.18). The sealed snapshot lives in the kit at `../kit/token-radar-01-kit/input/snapshot.json` and is **not** copied into this repo — the grader mounts its own `/input/snapshot.json`.

## Screenshots

No browser was installed on this machine, so Chromium Headless Shell 140 was installed via Playwright (`~/.cache/ms-playwright/chromium_headless_shell-1187`, `npm i playwright-core` in `/tmp/pw`, script `/tmp/pw/verify.mjs`). All three were taken at 1440×900 against `out/dashboard/index.html`:

- `1-board.png` (174 KB) — the board, 197 rows
- `2-detail.png` (206 KB) — detail view of rank #1 Steakhouse Financial, scrolled so the model arithmetic and farm plan are visible
- `3-filtered.png` (164 KB) — the board filtered to category Dexs (21 rows)

Deep links used: `#protocol=steakhouse-financial` and `#category=Dexs` (the dashboard also supports `#tab=live|model` and `#chain=<name>`).

## Verification done

- `main.ts` runs clean; two runs produce byte-identical output (including `dossier.json`)
- Every one of the 197 implied values was independently recomputed from the snapshot with a separate script — 0 mismatches
- Dossier rebuilt independently with `buildDossier` — byte-for-byte identical to the written `dossier.json` (760,731 bytes; text 33,932 of 65,536 allowed)
- Headless-browser checks (all passed): board renders 197 rows; detail farm steps match board.json; page recomputation matches board.json; Dexs filter shows 21 rows; live tab renders 50 rows; model tab explains the formula; the sandbox sliders re-rank the board live
- `out/` is local build output, gitignored, not part of the entry

## What remains for submission (not done here)

1. Create the public GitHub repo **after** 2026-11-14T10:00:00Z (competition opening) and commit this directory as its first commit — MIT LICENSE is already in the repo root.
2. Fill in the repo owner in `README.md` (currently `ndrean7`) and the `{referral_code}` placeholder if a referral code applies; set the repo About (description, homepage `https://make.fun/bounty/token-radar-01`, topics `makefun, ai-agents, bounties, trading`).
3. Create a Solana keypair for the make.fun account (payout wallet) and register / log in on make.fun — **do this yourself, never paste a keypair into a chat**.
4. Bundle the agent transcripts that built this entry (`transcripts.tar.gz`) — this session's transcripts are what the transcript gate counts.
5. Run the pre-submit check from the kit directory: `node cli/makefun.mjs check --kit . --repo <your repository> --transcripts transcripts.tar.gz`, then submit: `node cli/makefun.mjs submit --competition token-radar-01 --repo-url <url> --commit <sha> --title <name> --bundle <file> --keypair <file>`.
6. At most 5 submissions a day, 10 in all; the last submission before Mon 14 Dec 2026 10:00 UTC is the final entry.
