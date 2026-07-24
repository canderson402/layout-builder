import { describe, it, expect } from 'vitest';
import registry from '../../../../protocol/protocol-registry.json';
import { DATA_PATH_OPTIONS } from './dataPathOptions';

/**
 * Guards against drift between the protocol registry (single source of
 * truth for wire-level GameData fields) and the layout-builder's bindable
 * path catalog (dataPathOptions.ts).
 *
 * Excluded from this check (structural / not directly bindable scalars):
 *  - ingest: setSave, penalties, shootout, periodScores, tennisSetSlots,
 *    leaderboardEvent — handled via slot templates, not scalar binds.
 *  - id: overtime_rules, tennis_matches — structural objects.
 *  - id: setting — dynamic gameSettings.{key}; catalog exposes specific
 *    known settings instead of every possible key.
 *  - id: team — concrete bindables (homeTeam.name/awayTeam.name/
 *    home_team_color/away_team_color) are already covered separately.
 */

interface RegistryEntry {
  id: string;
  path: string;
  ingest: string;
  teamKeyed: boolean;
}

const EXCLUDED_INGEST = new Set([
  'setSave',
  'penalties',
  'shootout',
  'periodScores',
  'tennisSetSlots',
  'leaderboardEvent',
]);

const EXCLUDED_IDS = new Set(['overtime_rules', 'tennis_matches', 'setting', 'team']);

function expandPath(entry: RegistryEntry): string[] {
  // Some entries (e.g. baseball_on_base) encode multiple discrete GameData
  // fields as a comma-joined path — split into individual bindable paths.
  const subPaths = entry.path.split(',');
  return subPaths.flatMap(p => {
    if (!p.includes('{team}')) return [p];
    return ['home', 'away'].map(team => p.replace('{team}', team));
  });
}

describe('dataPathOptions vs protocol-registry', () => {
  const entries = (registry as RegistryEntry[]).filter(
    e => !EXCLUDED_INGEST.has(e.ingest) && !EXCLUDED_IDS.has(e.id),
  );

  // tennis_points path template `setSlots.{team}Points` doesn't match the
  // actual handler output (`setSlots.homePoints`/`setSlots.awayPoints`) via
  // naive {team} substitution producing `setSlots.homePoints` correctly
  // since {team} -> home + "Points" = "homePoints". Verify that assumption.
  it('sanity: tennis_points path expands to setSlots.homePoints/awayPoints', () => {
    const tennisPoints = entries.find(e => e.id === 'tennis_points')!;
    expect(expandPath(tennisPoints)).toEqual(['setSlots.homePoints', 'setSlots.awayPoints']);
  });

  const knownValues = new Set(DATA_PATH_OPTIONS.map(o => o.value));

  entries.forEach(entry => {
    const paths = expandPath(entry);
    paths.forEach(path => {
      it(`registry entry "${entry.id}" -> "${path}" is bindable in dataPathOptions`, () => {
        expect(knownValues.has(path)).toBe(true);
      });
    });
  });
});
