# buzzer

Live NCAA March Madness alert system. Monitors tournament games via the ESPN unofficial API and posts alerts to Twitter/X when interesting things happen — close games, upsets, scoring runs, triple-doubles, and more.

## How it works

A long-lived Node.js process polls the ESPN scoreboard every 2 minutes. When a rule fires (e.g. a #12 seed takes the lead in the 2nd half), it formats a tweet and posts it. Alerts are deduplicated against PostgreSQL so re-runs never double-post.

## Alerts

**Scoreboard-based** (no box score fetch needed):
- Close game — margin ≤ 5 pts in final 5 minutes
- Upset brewing / confirmed — higher-numbered seed leads or wins
- Scoring run — 15+ unanswered points
- Blowout — margin ≥ 30 in 2nd half
- Comeback — team erases 15+ point deficit and takes the lead
- Overtime — game goes to OT/2OT/3OT+; final score when it ends

**Box score-based** (fetches game summary):
- Individual milestone — 30/40/50 point games
- Triple-double — approaching (8+ in 3 cats) and achieved
- Quadruple-double — approaching and achieved
- 5x5 — 5+ in all five stat categories
- Goose egg — 10+ minutes played with 0 pts/reb/ast

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
| Normal (cron, default 2 min) | `docker compose up -d` |
| Custom poll interval | `POLL_INTERVAL_MINUTES=5 docker compose up` or `--poll-interval=5` |
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

**Game summary** (fetched per live game — returns box score with player stats):
```
GET https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=401638636
```

## Stack

- **TypeScript** + tsx
- **ESPN Unofficial API** — no auth required
- **Twitter/X** via `twitter-api-v2`
- **PostgreSQL** (Docker) for state + deduplication
- **Kysely** for type-safe SQL
- **node-cron** for scheduling
- **pino** for structured logging
- **vitest** for tests

## License

MIT
