import axios, { AxiosInstance } from 'axios';
import { EspnScoreboardResponse, EspnSummaryResponse } from '../types/espn.js';

const BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball';
/** NCAA Tournament group ID */
const NCAA_TOURNAMENT_GROUP = '100';

export class EspnClient {
  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: BASE_URL,
      timeout: 10_000,
      headers: {
        'User-Agent': 'buzzer/1.0 (march-madness-alerts)',
      },
    });
  }

  async fetchScoreboard(date?: string): Promise<EspnScoreboardResponse> {
    const params: Record<string, string> = { groups: NCAA_TOURNAMENT_GROUP };
    if (date) params['dates'] = date;

    const response = await this.http.get<EspnScoreboardResponse>('/scoreboard', { params });
    return response.data;
  }

  async fetchGameSummary(gameId: string): Promise<EspnSummaryResponse> {
    const response = await this.http.get<EspnSummaryResponse>('/summary', {
      params: { event: gameId },
    });
    return response.data;
  }
}
