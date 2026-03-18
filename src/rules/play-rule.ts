import { Play, Game } from '../types/game.js';
import { Alert } from '../types/alert.js';

export interface PlayRule {
  readonly name: string;
  evaluate(play: Play, game: Game): Alert | null;
}
