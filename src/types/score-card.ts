import { Team, GameStatus } from './game.js';
import { AlertPriority } from './alert.js';

export interface GameCardContext {
  kind: 'game';
  priority: AlertPriority;
  awayTeam: Team;
  homeTeam: Team;
  period: number;
  clock: string;
  status: GameStatus;
  label: string;
}

export interface PlayerCardContext {
  kind: 'player';
  priority: AlertPriority;
  playerName: string;
  teamName: string;
  playerTeam: Team;
  statLine: string;
  awayTeam: Team;
  homeTeam: Team;
  period: number;
  clock: string;
  status: GameStatus;
}

export interface PlayCardContext {
  kind: 'play';
  priority: AlertPriority;
  awayTeam: Team;
  homeTeam: Team;
  awayScore: number;
  homeScore: number;
  period: number;
  clock: string;
  label: string;
  playerName?: string;
}

export type ScoreCardContext = GameCardContext | PlayerCardContext | PlayCardContext;
