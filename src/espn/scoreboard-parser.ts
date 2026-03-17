import { EspnScoreboardResponse, EspnCompetitor } from '../types/espn.js';
import { Game, Team, GameStatus } from '../types/game.js';

export function parseScoreboard(response: EspnScoreboardResponse): Game[] {
  return response.events.flatMap((event) => {
    return event.competitions.flatMap((competition) => {
      const home = competition.competitors.find((c) => c.homeAway === 'home');
      const away = competition.competitors.find((c) => c.homeAway === 'away');

      if (!home || !away) return [];

      const status = competition.status;
      const gameStatus = status.type.state as GameStatus;
      const clockSeconds = Math.round(status.clock);

      const game: Game = {
        id: event.id,
        status: gameStatus,
        period: status.period,
        clock: status.displayClock,
        clockSeconds,
        homeTeam: parseTeam(home),
        awayTeam: parseTeam(away),
        startTime: competition.date,
        venue: competition.venue
          ? `${competition.venue.fullName}, ${competition.venue.city}`
          : undefined,
      };
      return [game];
    });
  });
}

function parseTeam(competitor: EspnCompetitor): Team {
  // Seeds live in curatedRank.current, not team.seed
  const seed = competitor.curatedRank?.current ?? undefined;
  const record = competitor.records?.find((r) => r.type === 'total')?.summary;

  return {
    id: competitor.team.id,
    name: competitor.team.displayName,
    shortName: competitor.team.shortDisplayName,
    abbreviation: competitor.team.abbreviation,
    seed,
    score: parseInt(competitor.score, 10) || 0,
    record,
  };
}
