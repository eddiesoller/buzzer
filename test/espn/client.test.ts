import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EspnClient, EspnRateLimitError } from '../../src/espn/client.js';

function makeAxiosError(status: number): Error {
  const err = new Error(`Request failed with status ${status}`) as Error & { response: { status: number } };
  err.response = { status };
  return err;
}

// Each test gets a fresh client with mocked http.get.
// Both minDelayMs and backoffBaseMs are set to 0 so tests run instantly.
function makeClient() {
  const client = new EspnClient(0, 0);
  const mockGet = vi.fn();
  (client as any).http = { get: mockGet };
  return { client, mockGet };
}

describe('EspnClient error handling', () => {
  describe('EspnRateLimitError', () => {
    it('throws EspnRateLimitError on 403', async () => {
      const { client, mockGet } = makeClient();
      mockGet.mockRejectedValue(makeAxiosError(403));
      await expect(client.fetchScoreboard()).rejects.toThrow(EspnRateLimitError);
    });

    it('includes "IP ban" in message on 403', async () => {
      const { client, mockGet } = makeClient();
      mockGet.mockRejectedValue(makeAxiosError(403));
      await expect(client.fetchScoreboard()).rejects.toThrow(/IP ban/);
    });

    it('throws EspnRateLimitError after exhausting retries on 429', async () => {
      const { client, mockGet } = makeClient();
      mockGet.mockRejectedValue(makeAxiosError(429));
      await expect(client.fetchScoreboard()).rejects.toThrow(EspnRateLimitError);
    });

    it('throws EspnRateLimitError after exhausting retries on 503', async () => {
      const { client, mockGet } = makeClient();
      mockGet.mockRejectedValue(makeAxiosError(503));
      await expect(client.fetchScoreboard()).rejects.toThrow(EspnRateLimitError);
    });

    it('retries on 429 before giving up', async () => {
      const { client, mockGet } = makeClient();
      mockGet.mockRejectedValue(makeAxiosError(429));
      await expect(client.fetchScoreboard()).rejects.toThrow(EspnRateLimitError);
      // BACKOFF_RETRIES=3, so 1 initial + 3 retries = 4 total calls
      expect(mockGet).toHaveBeenCalledTimes(4);
    });

    it('succeeds if 429 resolves before retries are exhausted', async () => {
      const { client, mockGet } = makeClient();
      const data = { events: [] };
      mockGet
        .mockRejectedValueOnce(makeAxiosError(429))
        .mockResolvedValueOnce({ data });
      const result = await client.fetchScoreboard();
      expect(result).toEqual(data);
      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });

  describe('non-rate-limit errors', () => {
    it('bubbles up non-HTTP errors without wrapping', async () => {
      const { client, mockGet } = makeClient();
      const networkError = new Error('Network error');
      mockGet.mockRejectedValue(networkError);
      await expect(client.fetchScoreboard()).rejects.toBe(networkError);
    });

    it('bubbles up 404 without wrapping in EspnRateLimitError', async () => {
      const { client, mockGet } = makeClient();
      mockGet.mockRejectedValue(makeAxiosError(404));
      await expect(client.fetchScoreboard()).rejects.not.toThrow(EspnRateLimitError);
    });

    it('does not retry on non-rate-limit errors', async () => {
      const { client, mockGet } = makeClient();
      mockGet.mockRejectedValue(makeAxiosError(500));
      await expect(client.fetchScoreboard()).rejects.toBeDefined();
      expect(mockGet).toHaveBeenCalledTimes(1);
    });
  });

  describe('successful responses', () => {
    it('returns data on success', async () => {
      const { client, mockGet } = makeClient();
      const data = { events: [{ id: '123' }] };
      mockGet.mockResolvedValue({ data });
      const result = await client.fetchScoreboard();
      expect(result).toEqual(data);
    });

    it('passes date param to scoreboard endpoint', async () => {
      const { client, mockGet } = makeClient();
      mockGet.mockResolvedValue({ data: {} });
      await client.fetchScoreboard('20260319');
      expect(mockGet).toHaveBeenCalledWith('/scoreboard', {
        params: expect.objectContaining({ dates: '20260319' }),
      });
    });

    it('passes event param to summary endpoint', async () => {
      const { client, mockGet } = makeClient();
      mockGet.mockResolvedValue({ data: {} });
      await client.fetchGameSummary('game123');
      expect(mockGet).toHaveBeenCalledWith('/summary', {
        params: { event: 'game123' },
      });
    });
  });

  describe('throttle', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('enforces min delay between requests', async () => {
      const client = new EspnClient(500);
      const mockGet = vi.fn().mockResolvedValue({ data: {} });
      (client as any).http = { get: mockGet };

      // Set lastRequestAt to now so next request will be throttled
      (client as any).lastRequestAt = Date.now();

      const promise = client.fetchScoreboard();
      // Before the timer advances, get should not have been called yet
      expect(mockGet).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(500);
      await promise;
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('does not delay when last request was long ago', async () => {
      const client = new EspnClient(500);
      const mockGet = vi.fn().mockResolvedValue({ data: {} });
      (client as any).http = { get: mockGet };

      // Set lastRequestAt to 1 second in the past — no delay needed
      (client as any).lastRequestAt = Date.now() - 1000;

      await client.fetchScoreboard();
      expect(mockGet).toHaveBeenCalledTimes(1);
    });
  });
});
