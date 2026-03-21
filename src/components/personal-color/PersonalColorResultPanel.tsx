import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { ChevronDown, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';

type Analysis = {
  summary?: string;
  confidence?: string;
  season?: string;
  secondaryTone?: string;
  undertone?: string;
  chroma?: string;
  contrast?: string;
  warmthScore?: number;
  brightnessScore?: number;
  saturationScore?: number;
  contrastScore?: number;
  signatureKeywords?: string[];
  bestColors?: string[];
  avoidColors?: string[];
  makeup?: {
    base?: string;
    lip?: string;
    blush?: string;
    eye?: string;
  };
  hair?: {
    best?: string;
    avoid?: string;
  };
  stylingTips?: string[];
  cautions?: string[];
};

declare global {
  interface WindowEventMap {
    'manytool:ai-personal-color-result': CustomEvent<Analysis | null>;
  }
}

const initialSummary = '아직 분석 결과가 없습니다. 사진을 준비하고 분석 시작을 누르면 대표 톤과 상세 리포트가 여기에 표시됩니다.';

const confidenceLabelMap: Record<string, string> = {
  low: '낮음',
  medium: '보통',
  high: '높음'
};

export function PersonalColorResultPanel() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const handleResult = (event: WindowEventMap['manytool:ai-personal-color-result']) => {
      setAnalysis(event.detail ?? null);
      if (event.detail) setExpanded(true);
    };
    window.addEventListener('manytool:ai-personal-color-result', handleResult);
    return () => window.removeEventListener('manytool:ai-personal-color-result', handleResult);
  }, []);

  const radarData = useMemo(() => {
    if (!analysis) return [];
    return [
      { subject: '웜감', score: analysis.warmthScore ?? 50 },
      { subject: '명도', score: analysis.brightnessScore ?? 50 },
      { subject: '채도', score: analysis.saturationScore ?? 50 },
      { subject: '대비감', score: analysis.contrastScore ?? 50 }
    ];
  }, [analysis]);

  const barData = useMemo(() => {
    if (!analysis) return [];
    return [
      { name: '웜감', value: analysis.warmthScore ?? 50 },
      { name: '명도', value: analysis.brightnessScore ?? 50 },
      { name: '채도', value: analysis.saturationScore ?? 50 },
      { name: '대비감', value: analysis.contrastScore ?? 50 }
    ];
  }, [analysis]);

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-rose-200 bg-[linear-gradient(145deg,#fff7ed_0%,#fff1f2_48%,#ffffff_100%)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-700 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              간단 결과
            </p>
            <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-900">
              {analysis?.season || '대표 톤 분석 대기 중'}
            </h3>
            {analysis?.secondaryTone ? (
              <p className="mt-2 text-sm font-semibold text-rose-700">
                세부 톤: {analysis.secondaryTone}
              </p>
            ) : null}
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {analysis?.summary || initialSummary}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {analysis?.confidence ? (
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                신뢰도 {confidenceLabelMap[analysis.confidence] || analysis.confidence}
              </span>
            ) : null}
            {analysis?.undertone ? (
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                언더톤 {analysis.undertone}
              </span>
            ) : null}
            {analysis?.chroma ? (
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                채도 {analysis.chroma}
              </span>
            ) : null}
            {analysis?.contrast ? (
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                대비감 {analysis.contrast}
              </span>
            ) : null}
          </div>
        </div>

        {analysis?.signatureKeywords?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {analysis.signatureKeywords.map((keyword) => (
              <span key={keyword} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-700 shadow-sm">
                #{keyword}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">상세보기</h3>
            <p className="mt-1 text-sm text-slate-600">퍼스널컬러 용어와 점수형 차트를 같이 보여주는 리포트입니다.</p>
          </div>
          <Button type="button" variant="outline" className="gap-2" onClick={() => setExpanded((prev) => !prev)} disabled={!analysis}>
            {expanded ? '상세 접기' : '상세 펼치기'}
            <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        {expanded && analysis ? (
          <div className="mt-5 space-y-5">
            <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <section className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-xs font-semibold text-amber-700">진단 축</p>
                <div className="mt-3 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#f59e0b" strokeOpacity={0.25} />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#92400e', fontSize: 12 }} />
                      <Radar dataKey="score" stroke="#f97316" fill="#fb923c" fillOpacity={0.35} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                <p className="text-xs font-semibold text-sky-700">점수형 프로필</p>
                <div className="mt-3 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#bae6fd" />
                      <XAxis dataKey="name" tick={{ fill: '#0f172a', fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="#0284c7" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <h4 className="text-sm font-bold text-slate-900">베스트 컬러</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(analysis.bestColors || []).map((item) => (
                    <span key={item} className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-emerald-700">
                      {item}
                    </span>
                  ))}
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-bold text-slate-900">비추천 컬러</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(analysis.avoidColors || []).map((item) => (
                    <span key={item} className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                <h4 className="text-sm font-bold text-slate-900">메이크업 추천</h4>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  <li><strong>베이스:</strong> {analysis.makeup?.base || '-'}</li>
                  <li><strong>립:</strong> {analysis.makeup?.lip || '-'}</li>
                  <li><strong>블러셔:</strong> {analysis.makeup?.blush || '-'}</li>
                  <li><strong>아이:</strong> {analysis.makeup?.eye || '-'}</li>
                </ul>
              </section>
              <section className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                <h4 className="text-sm font-bold text-slate-900">헤어 컬러 가이드</h4>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  <li><strong>추천:</strong> {analysis.hair?.best || '-'}</li>
                  <li><strong>비추천:</strong> {analysis.hair?.avoid || '-'}</li>
                </ul>
              </section>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h4 className="text-sm font-bold text-slate-900">스타일링 팁</h4>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {(analysis.stylingTips || []).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h4 className="text-sm font-bold text-slate-900">주의 포인트</h4>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {(analysis.cautions || []).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </section>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default PersonalColorResultPanel;
