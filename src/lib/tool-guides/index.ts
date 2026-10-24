import { dailyGuides } from './daily';
import { funGuides } from './fun';
import { gameGuides } from './game';
import { hubGuides } from './hubs';
import { partyGuides } from './party';
import { utilityGuides } from './utility';

export type ToolGuide = {
  /** Short tool name used in the section heading. */
  name: string;
  intro: string[];
  steps: string[];
  /** [title, text] */
  useCases: [string, string][];
  tips: string[];
  /** [question, answer] */
  faq: [string, string][];
};

const guides: Record<string, ToolGuide> = { ...funGuides, ...partyGuides, ...gameGuides, ...utilityGuides, ...dailyGuides, ...hubGuides };

export const getToolGuide = (path: string): ToolGuide | undefined => guides[path.replace(/\/+$/, '') || '/'];
