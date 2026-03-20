// ESPN Unofficial API response types

export interface EspnScoreboardResponse {
  events: EspnEvent[];
}

export interface EspnEvent {
  id: string;
  date: string;
  name: string;
  shortName: string;
  competitions: EspnCompetition[];
  status: EspnEventStatus;
}

export interface EspnEventStatus {
  clock: number;
  displayClock: string;
  period: number;
  type: EspnStatusType;
}

export interface EspnStatusType {
  id: string;
  name: string;
  state: 'pre' | 'in' | 'post';
  completed: boolean;
  description: string;
  detail: string;
  shortDetail: string;
}

export interface EspnCompetition {
  id: string;
  date: string;
  competitors: EspnCompetitor[];
  status: EspnEventStatus;
  venue?: EspnVenue;
  broadcasts?: EspnBroadcast[];
  situation?: {
    lastPlay?: {
      probability?: {
        homeWinPercentage: number;
        awayWinPercentage: number;
        tiePercentage: number;
      };
    };
  };
}

export interface EspnCompetitor {
  id: string;
  homeAway: 'home' | 'away';
  score: string;
  team: EspnTeam;
  records?: EspnRecord[];
  curatedRank?: { current: number };
}

export interface EspnTeam {
  id: string;
  displayName: string;
  shortDisplayName: string;
  abbreviation: string;
  color?: string;
  alternateColor?: string;
  logo?: string;
  seed?: string;
}

export interface EspnRecord {
  name?: string;
  summary: string;
  type?: string;
}

export interface EspnVenue {
  id: string;
  fullName: string;
  city: string;
  state: string;
}

export interface EspnBroadcast {
  market: string;
  names: string[];
}

// Summary endpoint types
export interface EspnSummaryResponse {
  boxscore?: EspnBoxscore;
  header?: EspnHeader;
  plays?: EspnPlay[];
}

export interface EspnPlay {
  id: string;
  sequenceNumber: string;
  scoringPlay: boolean;
  homeScore: number;
  awayScore: number;
  period: { number: number; displayValue: string };
  clock: { displayValue: string };
  team?: { id: string };
  text: string;
  coordinate?: { x: number; y: number };
}

export interface EspnHeader {
  id: string;
  competitions: EspnCompetition[];
}

export interface EspnBoxscore {
  teams: EspnBoxscoreTeam[];
  players: EspnBoxscorePlayers[];
}

export interface EspnBoxscoreTeam {
  team: EspnTeam;
  statistics: EspnTeamStatEntry[];
}

export interface EspnTeamStatEntry {
  name: string;
  displayValue: string;
  label: string;
}

export interface EspnBoxscorePlayers {
  team: EspnTeam;
  statistics: EspnPlayerStatGroup[];
}

export interface EspnPlayerStatGroup {
  names: string[];
  keys: string[];
  labels: string[];
  descriptions: string[];
  athletes: EspnPlayerStatEntry[];
  totals: string[];
}

export interface EspnPlayerStatEntry {
  athlete: EspnAthlete;
  starter: boolean;
  didNotPlay: boolean;
  ejected: boolean;
  stats: string[];
}

export interface EspnAthlete {
  id: string;
  displayName: string;
  shortName: string;
  jersey?: string;
  position?: { abbreviation: string };
}
