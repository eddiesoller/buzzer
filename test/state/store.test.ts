import { describe, it, expect, vi } from 'vitest';
import { StateStore } from '../../src/state/store.js';
import { makeAlert } from '../rules/helpers.js';

function makeMockDb() {
  const firedAlerts = new Map<string, true>();
  const savedGames = new Map<string, string>();

  return {
    firedAlerts,
    savedGames,
    selectFrom: vi.fn((table: string) => {
      if (table === 'fired_alerts') {
        return {
          select: () => ({
            where: (_col: string, _op: string, value: string | string[]) => ({
              executeTakeFirst: async () =>
                typeof value === 'string' && firedAlerts.has(value)
                  ? { alert_id: value }
                  : undefined,
              execute: async () =>
                (Array.isArray(value) ? value : [value])
                  .filter((id) => firedAlerts.has(id))
                  .map((id) => ({ alert_id: id })),
            }),
          }),
        };
      }
      if (table === 'games') {
        return {
          selectAll: () => ({
            where: (_col: string, _op: string, id: string) => ({
              executeTakeFirst: async () => {
                const data = savedGames.get(id);
                return data ? { rule_data: data } : undefined;
              },
            }),
          }),
        };
      }
      throw new Error(`Unknown table: ${table}`);
    }),
    insertInto: vi.fn((table: string) => {
      if (table === 'fired_alerts') {
        return {
          values: (row: { alert_id: string }) => ({
            onConflict: () => ({
              execute: async () => {
                firedAlerts.set(row.alert_id, true);
              },
            }),
          }),
        };
      }
      if (table === 'games') {
        return {
          values: (row: { id: string; rule_data: unknown }) => ({
            onConflict: () => ({
              execute: async () => {
                // Not testing game save internals here
              },
            }),
          }),
        };
      }
      throw new Error(`Unknown table: ${table}`);
    }),
  };
}

describe('StateStore.hasAlertFired', () => {
  it('returns false when alert has not fired', async () => {
    const db = makeMockDb();
    const store = new StateStore(db as any);
    expect(await store.hasAlertFired('daily-summary:2026-03-19')).toBe(false);
  });

  it('returns true when alert has fired', async () => {
    const db = makeMockDb();
    db.firedAlerts.set('daily-summary:2026-03-19', true);
    const store = new StateStore(db as any);
    expect(await store.hasAlertFired('daily-summary:2026-03-19')).toBe(true);
  });

  it('is case-sensitive', async () => {
    const db = makeMockDb();
    db.firedAlerts.set('daily-summary:2026-03-19', true);
    const store = new StateStore(db as any);
    expect(await store.hasAlertFired('daily-summary:2026-03-20')).toBe(false);
  });
});

describe('StateStore.filterNewAlerts', () => {
  it('returns all alerts when none have fired', async () => {
    const db = makeMockDb();
    const store = new StateStore(db as any);
    const alerts = [makeAlert({ id: 'a:game1' }), makeAlert({ id: 'b:game1' })];
    const result = await store.filterNewAlerts(alerts);
    expect(result).toHaveLength(2);
  });

  it('filters out already-fired alerts', async () => {
    const db = makeMockDb();
    db.firedAlerts.set('a:game1', true);
    const store = new StateStore(db as any);
    const alerts = [makeAlert({ id: 'a:game1' }), makeAlert({ id: 'b:game1' })];
    const result = await store.filterNewAlerts(alerts);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('b:game1');
  });

  it('returns empty array for empty input', async () => {
    const db = makeMockDb();
    const store = new StateStore(db as any);
    expect(await store.filterNewAlerts([])).toHaveLength(0);
  });

  it('filters out all alerts if all have fired', async () => {
    const db = makeMockDb();
    db.firedAlerts.set('a:game1', true);
    db.firedAlerts.set('b:game1', true);
    const store = new StateStore(db as any);
    const alerts = [makeAlert({ id: 'a:game1' }), makeAlert({ id: 'b:game1' })];
    expect(await store.filterNewAlerts(alerts)).toHaveLength(0);
  });
});
