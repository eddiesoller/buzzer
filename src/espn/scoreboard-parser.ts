import { z } from 'zod';
import { EspnScoreboardResponse, EspnCompetitor } from '../types/espn.js';
import { Game, Team, GameStatus } from '../types/game.js';

const espnScoreboardSchema = z.object({
  events: z.array(z.object({
    id: z.string(),
    competitions: z.array(z.object({
      date: z.string(),
      competitors: z.array(z.object({
        homeAway: z.enum(['home', 'away']),
        score: z.string(),
        team: z.object({
          id: z.string(),
          displayName: z.string(),
          shortDisplayName: z.string(),
          abbreviation: z.string(),
          logo: z.string().optional(),
        }),
        records: z.array(z.object({
          type: z.string().optional(),
          summary: z.string(),
        })).optional(),
        curatedRank: z.object({ current: z.number() }).optional(),
      })),
      status: z.object({
        clock: z.number(),
        displayClock: z.string(),
        period: z.number(),
        type: z.object({
          state: z.enum(['pre', 'in', 'post']),
        }),
      }),
      venue: z.object({
        fullName: z.string(),
        city: z.string().optional(),
      }).optional(),
      situation: z.object({
        lastPlay: z.object({
          probability: z.object({
            homeWinPercentage: z.number(),
            awayWinPercentage: z.number(),
          }).optional(),
        }).optional(),
      }).optional(),
    })),
  })),
});

export function parseScoreboard(response: EspnScoreboardResponse): Game[] {
  const parsed = espnScoreboardSchema.safeParse(response);
  if (!parsed.success) {
    throw new Error(`ESPN scoreboard response validation failed: ${parsed.error.message}`);
  }

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
        homeWinPct: competition.situation?.lastPlay?.probability?.homeWinPercentage,
        awayWinPct: competition.situation?.lastPlay?.probability?.awayWinPercentage,
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
    logo: competitor.team.logo,
  };
}
