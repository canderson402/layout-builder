import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  valuesForPath,
  TRIVIA_PHASE_VALUES,
  TRIVIA_QUESTION_KIND_VALUES,
} from './dataPathOptions';
import { VARIANT_PATH_OPTIONS } from './variantOptions';

/**
 * Guards the enum-valued paths against drift from the TV app's types, which
 * are what actually arrive on the wire. A phase the builder offers but the TV
 * never sends is a condition that silently never fires.
 */
const gameDataTypes = readFileSync(
  resolve(__dirname, '../../../../src/types/gameData.ts'),
  'utf8',
);

const unionValues = (source: string, declaration: string): string[] => {
  const start = source.indexOf(declaration);
  expect(start, `${declaration} not found in gameData.ts`).toBeGreaterThan(-1);
  const body = source.slice(start + declaration.length, source.indexOf(';', start));
  return (body.match(/'([^']*)'/g) || []).map(m => m.slice(1, -1)).filter(Boolean);
};

describe('enum-valued data paths', () => {
  it('trivia phases match the TV app TriviaData.phase union', () => {
    const fromTypes = unionValues(gameDataTypes, 'phase:');
    expect(TRIVIA_PHASE_VALUES.map(v => v.value)).toEqual(fromTypes);
  });

  it('trivia question kinds match the TV app TriviaQuestionKind union', () => {
    const fromTypes = unionValues(gameDataTypes, 'export type TriviaQuestionKind =');
    expect(TRIVIA_QUESTION_KIND_VALUES.map(v => v.value)).toEqual(fromTypes);
  });

  it('every enum value has a label', () => {
    [...TRIVIA_PHASE_VALUES, ...TRIVIA_QUESTION_KIND_VALUES].forEach(v => {
      expect(v.label.length).toBeGreaterThan(0);
    });
  });

  it('resolves values for a full path', () => {
    expect(valuesForPath('trivia.phase')).toBe(TRIVIA_PHASE_VALUES);
  });

  it('returns undefined for free-form paths', () => {
    expect(valuesForPath('homeTeam.score')).toBeUndefined();
    expect(valuesForPath(undefined)).toBeUndefined();
    expect(valuesForPath('')).toBeUndefined();
  });

  it('variant options reuse the catalog enum rather than a second copy', () => {
    const questionKind = VARIANT_PATH_OPTIONS.find(o => o.path === 'trivia.questionKind');
    expect(questionKind?.values).toBe(TRIVIA_QUESTION_KIND_VALUES);
  });
});
