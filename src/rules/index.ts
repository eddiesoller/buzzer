import { AlertRule } from './rule.js';
import { PlayRule } from './play-rule.js';
import { CloseGameRule } from './close-game.js';
import { UpsetBrewingRule } from './upset-brewing.js';
import { ScoringRunRule } from './scoring-run.js';
import { ComebackRule } from './comeback.js';
import { OvertimeRule } from './overtime.js';
import { GameFinalRule } from './game-final.js';
import { ScoringMilestoneRule } from './scoring-milestone.js';
import { MultiDoubleRule } from './multi-double.js';
import { FiveByFiveRule } from './five-by-five.js';
import { GooseEggRule } from './goose-egg.js';
import { BigShotRule } from './big-shot.js';
import { PlayerGameSummaryRule } from './player-game-summary.js';

export const SCOREBOARD_RULES: AlertRule[] = [
  new CloseGameRule(),
  new UpsetBrewingRule(),
  new ScoringRunRule(),
  new ComebackRule(),
  new OvertimeRule(),
  new GameFinalRule(),
];

export const BOX_SCORE_RULES: AlertRule[] = [
  new ScoringMilestoneRule(),
  new MultiDoubleRule(),
  new FiveByFiveRule(),
  new GooseEggRule(),
  new PlayerGameSummaryRule(),
];

export const PLAY_RULES: PlayRule[] = [new BigShotRule()];
