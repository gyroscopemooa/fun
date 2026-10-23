import { LOVE_TYPE_TEST } from './love-type';
import { OFFICE_TYPE_TEST } from './office-type';
import type { TypeTestDef, TypeTestResult } from './types';

export type { TypeTestDef, TypeTestResult } from './types';

export const TYPE_TESTS: Record<string, TypeTestDef> = {
  [LOVE_TYPE_TEST.slug]: LOVE_TYPE_TEST,
  [OFFICE_TYPE_TEST.slug]: OFFICE_TYPE_TEST
};

/** Highest total wins; ties go to the result listed first. */
export const scoreTypeTest = (test: TypeTestDef, picks: number[]): TypeTestResult => {
  const totals = new Map(test.results.map((r) => [r.id, 0]));
  picks.forEach((pick, i) => {
    const option = test.questions[i]?.options[pick];
    if (!option) return;
    Object.entries(option.scores).forEach(([id, points]) => totals.set(id, (totals.get(id) ?? 0) + points));
  });
  return test.results.reduce((best, r) => ((totals.get(r.id) ?? 0) > (totals.get(best.id) ?? 0) ? r : best), test.results[0]);
};

export const resultOf = (test: TypeTestDef, id: string) => test.results.find((r) => r.id === id);
