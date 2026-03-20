import axios, { AxiosInstance } from 'axios';
import { EspnScoreboardResponse, EspnSummaryResponse } from '../types/espn.js';

const BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball';
/** NCAA Tournament group ID */
const NCAA_TOURNAMENT_GROUP = '100';
const DEFAULT_MIN_DELAY_MS = 500;
const BACKOFF_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;

export class EspnRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EspnRateLimitError';
  }
}

export class EspnClient {
  private http: AxiosInstance;
  private lastRequestAt = 0;
  private readonly minDelayMs: number;
  private readonly backoffBaseMs: number;

  constructor(minDelayMs = DEFAULT_MIN_DELAY_MS, backoffBaseMs = BACKOFF_BASE_MS) {
    this.minDelayMs = minDelayMs;
    this.backoffBaseMs = backoffBaseMs;
    this.http = axios.create({
      baseURL: BASE_URL,
      timeout: 10_000,
      headers: {
        'User-Agent': 'buzzer/1.0 (march-madness-alerts)',
      },
    });
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.minDelayMs) {
      await new Promise<void>((r) => setTimeout(r, this.minDelayMs - elapsed));
    }
    this.lastRequestAt = Date.now();
  }

  private async request<T>(path: string, params: Record<string, string>): Promise<T> {
    await this.throttle();
    let lastErr: unknown;
    for (let attempt = 0; attempt <= BACKOFF_RETRIES; attempt++) {
      try {
        const response = await this.http.get<T>(path, { params });
        return response.data;
      } catch (err) {
        lastErr = err;
        const status = (err as { response?: { status?: number } })?.response?.status;

        if (status === 403) {
          throw new EspnRateLimitError('ESPN returned 403 — possible IP ban');
        }

        if (status === 429 || status === 503) {
          if (attempt < BACKOFF_RETRIES) {
            await new Promise<void>((r) => setTimeout(r, this.backoffBaseMs * 2 ** attempt));
            continue;
          }
          throw new EspnRateLimitError(`ESPN rate limit (${status}) after ${BACKOFF_RETRIES} retries`);
        }

        throw err;
      }
    }
    throw lastErr;
  }

  async fetchScoreboard(date?: string): Promise<EspnScoreboardResponse> {
    const params: Record<string, string> = { groups: NCAA_TOURNAMENT_GROUP };
    if (date) params['dates'] = date;
    return this.request<EspnScoreboardResponse>('/scoreboard', params);
  }

  async fetchGameSummary(gameId: string, delayMs?: number): Promise<EspnSummaryResponse> {
    if (delayMs) {
      await new Promise<void>((r) => setTimeout(r, delayMs));
    }
    return this.request<EspnSummaryResponse>('/summary', { event: gameId });
  }
}
