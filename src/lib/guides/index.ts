import { docGuides } from './docs';
import { gameGuides } from './games';
import { lifeGuides } from './life';
import type { Guide } from './types';

export * from './types';

export const GUIDES: Guide[] = [...docGuides, ...lifeGuides, ...gameGuides];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);

/** Guides that link to a given tool page, for "related guide" links on tool pages. */
export const guidesForTool = (path: string) => GUIDES.filter((g) => g.tools.some((t) => t.href === path.replace(/\/+$/, '')));

/** Plain-text length of a guide, used for the reading time. */
export const guideLength = (g: Guide) =>
  [...g.intro, ...g.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.list?.items ?? []), s.tip ?? '', ...(s.table?.flat() ?? [])]), ...g.faq.flat()].join('').replace(/\s/g, '').length;

/** Korean reading speed of roughly 500 characters a minute. */
export const readMinutes = (g: Guide) => Math.max(2, Math.round(guideLength(g) / 500));
