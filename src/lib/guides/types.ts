export type GuideCategory = 'docs' | 'photo' | 'beauty' | 'game';

export type GuideSection = {
  heading: string;
  paragraphs: string[];
  /** Optional numbered steps or bullet points under the paragraphs. */
  list?: { ordered?: boolean; items: string[] };
  /** Optional highlighted tip box. */
  tip?: string;
  /** Optional simple table: first row is the header. */
  table?: string[][];
};

export type Guide = {
  slug: string;
  category: GuideCategory;
  title: string;
  /** Meta description and card summary. */
  description: string;
  keywords: string;
  emoji: string;
  /** ISO date (YYYY-MM-DD) of the last content update. */
  updated: string;
  intro: string[];
  sections: GuideSection[];
  faq: [string, string][];
  /** Tools this guide leads to. The first one is the main call to action. */
  tools: { href: string; label: string; note: string }[];
};

export const CATEGORY_LABEL: Record<GuideCategory, string> = {
  docs: '문서·PDF',
  photo: '사진·이미지',
  beauty: '퍼스널컬러·뷰티',
  game: '게임'
};
