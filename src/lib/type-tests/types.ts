// Shared shapes for the one-question-per-screen type tests. Kept import-free so
// scripts/generate-og-images.mjs can load the data files with Node's type stripping.

export type TypeTestResult = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  summary: string;
  traits: string[];
  tip: string;
  best: string;
};

export type TypeTestOption = { label: string; scores: Record<string, number> };
export type TypeTestQuestion = { text: string; options: TypeTestOption[] };

export type TypeTestDef = {
  slug: string;
  title: string;
  kicker: string;
  intro: string;
  bestLabel: string;
  gradient: [string, string];
  questions: TypeTestQuestion[];
  results: TypeTestResult[];
};
