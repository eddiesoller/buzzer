import fs from 'fs/promises';
import { generateScoreCard } from '../src/formatters/score-card.js';
import { GameCardContext, PlayerCardContext, PlayCardContext } from '../src/types/score-card.js';
import { Team } from '../src/types/game.js';

const duke: Team    = { id: '150', name: 'Duke', shortName: 'Duke', abbreviation: 'DUKE', seed: 2, score: 74, record: '31-4', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/150.png' };
const carolina: Team = { id: '153', name: 'North Carolina', shortName: 'UNC', abbreviation: 'UNC', seed: 7, score: 71, record: '26-10', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/153.png' };
const kansas: Team  = { id: '2305', name: 'Kansas', shortName: 'Kansas', abbreviation: 'KU', seed: 1, score: 79, record: '33-2', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2305.png' };
const houston: Team = { id: '248', name: 'Houston', shortName: 'Houston', abbreviation: 'HOU', seed: 3, score: 82, record: '30-5', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/248.png' };

async function write(name: string, buf: Buffer) {
  const path = `/tmp/scorecard-${name}.png`;
  await fs.writeFile(path, buf);
  console.log(`Wrote ${path}`);
}

async function main() {
  // Low priority — scoring run (blue)
  await write('low-game', await generateScoreCard({
    kind: 'game', priority: 'low',
    awayTeam: carolina, homeTeam: duke,
    period: 1, clock: '8:14', status: 'in',
    label: 'SCORING RUN',
  } satisfies GameCardContext));

  // Medium priority — close game (orange)
  await write('med-game', await generateScoreCard({
    kind: 'game', priority: 'medium',
    awayTeam: carolina, homeTeam: duke,
    period: 2, clock: '3:42', status: 'in',
    label: 'CLOSE GAME',
  } satisfies GameCardContext));

  // High priority — player milestone (red)
  await write('high-player', await generateScoreCard({
    kind: 'player', priority: 'high',
    playerName: 'Armando Bacot',
    teamName: 'North Carolina',
    playerTeam: carolina,
    statLine: '35 PTS  12 REB  7 AST',
    awayTeam: carolina, homeTeam: duke,
    period: 2, clock: '5:10', status: 'in',
  } satisfies PlayerCardContext));

  // High priority — buzzer beater (red)
  await write('high-play', await generateScoreCard({
    kind: 'play', priority: 'high',
    awayTeam: houston, homeTeam: kansas,
    awayScore: 82, homeScore: 79,
    period: 2, clock: '0:00',
    label: 'BUZZER BEATER',
    playerName: 'Jamal Shead',
  } satisfies PlayCardContext));

  // Medium priority — go-ahead shot (orange)
  await write('med-play', await generateScoreCard({
    kind: 'play', priority: 'medium',
    awayTeam: houston, homeTeam: kansas,
    awayScore: 80, homeScore: 79,
    period: 2, clock: '0:38',
    label: 'GO-AHEAD SHOT',
    playerName: 'Jamal Shead',
  } satisfies PlayCardContext));
}

main().catch((err) => { console.error(err); process.exit(1); });
