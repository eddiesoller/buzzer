# buzzer

Live NCAA March Madness alert system. Monitors tournament games via the ESPN unofficial API and posts alerts to Twitter/X when interesting things happen — close games, upsets, scoring runs, buzzer beaters, and more.

## How it works

A long-lived Node.js process uses a two-tier polling architecture:

- **Scoreboard tier** (every `POLL_INTERVAL_MINUTES`, default 2 min): Fetches the ESPN scoreboard. Manages per-game watcher lifecycle — starts a watcher for each newly live game, stops watchers when games finish.
- **Game watcher tier** (every `ACTIVE_POLL_INTERVAL_SECONDS`, default 30 s, per live game): Fetches the game summary. Evaluates all rules. Advances a per-game play cursor (`lastProcessedSeq`) so play-level rules only see new plays. The cursor is persisted to PostgreSQL so restarts never reprocess old plays.

Average alert latency is ~15–45 seconds from the real event. When a rule fires (e.g. a #12 seed takes the lead in the 2nd half), it formats a tweet and posts it. Alerts are deduplicated against PostgreSQL so re-runs never double-post.

## Alerts

**Scoreboard-based** (no box score fetch needed):
- Close game — margin ≤ 5 pts in final 5 minutes
- Upset brewing / confirmed — higher-numbered seed leads or wins
- Scoring run — 15+ unanswered points (re-fires at every 5-point threshold: 15, 20, 25, 30...)
- Blowout — margin ≥ 30 in 2nd half
- Comeback — team erases 15+ point deficit and takes the lead
- Overtime — game goes to OT/2OT/3OT+; final score when it ends

**Box score-based** (fetches game summary):
- Individual milestone — 30/40/50 point games
- Triple-double — approaching (8+ in 3 cats) and achieved
- Quadruple-double — approaching and achieved
- 5x5 — 5+ in all five stat categories
- Goose egg — 10+ minutes played with 0 pts/reb/ast

**Play-based** (per new play via play cursor):
- Big shot — 40+ foot made shots and buzzer beaters (with distance in feet)

## Setup

```bash
cp .env.example .env
# Fill in TWITTER_* credentials if you want tweets posted
docker compose up -d
```

Logs:
```bash
docker compose logs -f buzzer
```

## Run modes

| Mode | How |
|------|-----|
| Normal (default) | `docker compose up -d` |
| Custom scoreboard interval | `POLL_INTERVAL_MINUTES=5 docker compose up` or `--poll-interval=5` |
| Faster live-game polling | `ACTIVE_POLL_INTERVAL_SECONDS=15 npm start` |
| Dry run (no tweets, no DB writes) | `DRY_RUN=true docker compose up` or `--dry-run` |
| Single execution then exit | `SINGLE_RUN=true docker compose run --rm buzzer` or `--single-run` |

## Development

```bash
npm install
cp .env.example .env        # point at a local postgres
npm run dev                 # tsx watch mode
npm test                    # vitest
```

Capture live ESPN responses as test fixtures during a game:
```bash
npm run capture-fixture                  # captures scoreboard + first live game
npm run capture-fixture -- <gameId>      # captures a specific game summary
```

## ESPN API

Uses the ESPN unofficial API — no authentication required.

**Scoreboard** (polled every N minutes — returns all live/upcoming tournament games):
```
GET https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=100
```
`groups=100` filters to NCAA Tournament games. Optionally append `&dates=YYYYMMDD` to fetch a specific date.

**Game summary** (fetched per live game — returns box score with player stats and play-by-play):
```
GET https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=401638636
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `POLL_INTERVAL_MINUTES` | `2` | How often to poll the scoreboard (1–60 min) |
| `ACTIVE_POLL_INTERVAL_SECONDS` | `30` | How often each live-game watcher fetches the summary (5–300 s) |
| `DRY_RUN` | `false` | Log alerts but don't post tweets or write to DB |
| `SINGLE_RUN` | `false` | Execute once and exit |
| `LOG_LEVEL` | `info` | Pino log level |
| `HEALTHCHECK_URL` | — | Optional healthchecks.io ping URL |

## How alerts work / deduplication

Each alert has a stable ID (e.g. `scoring-run:gameId:teamId:15`). Before posting, the runner queries `fired_alerts` in PostgreSQL. Alerts already in that table are dropped. This means:
- Restarting the process never double-posts.
- The play cursor (`lastProcessedSeq` stored in `rule_data` JSONB) ensures play-level rules only evaluate new plays after a restart.
- `ScoringRunRule` uses threshold-based IDs (snapped to 15, 20, 25, 30) so fast polling doesn't spam during a run — it fires once per threshold.

## Stack

- **TypeScript** + tsx
- **ESPN Unofficial API** — no auth required
- **Twitter/X** via `twitter-api-v2`
- **PostgreSQL** (Docker) for state + deduplication
- **Kysely** for type-safe SQL
- **pino** for structured logging
- **vitest** for tests

## License

MIT
