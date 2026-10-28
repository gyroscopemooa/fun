import { useState } from 'react';

import { CalorieReport, type CalorieAnalysis } from './CalorieReport';

import salad from '@/data/calorie-samples/chicken-salad.json';
import noodles from '@/data/calorie-samples/jajangmyeon.json';
import sushi from '@/data/calorie-samples/tuna-sushi.json';

// Actual production-analyzer responses, retained with their source-photo provenance.
const SAMPLES: { id: string; label: string; emoji: string; photoUrl: string; analysis: CalorieAnalysis }[] = [salad, noodles, sushi];

export function CalorieSampleShowcase() {
  const [active, setActive] = useState(SAMPLES[0].id);
  const sample = SAMPLES.find((item) => item.id === active) ?? SAMPLES[0];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {SAMPLES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActive(item.id)}
            aria-pressed={item.id === active}
            className={`flex items-center gap-2 rounded-full border py-1.5 pl-2 pr-4 text-sm font-bold transition ${item.id === active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}
          >
            <span className="text-lg leading-none">{item.emoji}</span>
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <CalorieReport key={sample.id} analysis={sample.analysis} photoUrl={sample.photoUrl} sample />
      </div>
    </div>
  );
}

export default CalorieSampleShowcase;
