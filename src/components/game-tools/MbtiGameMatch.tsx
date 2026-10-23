import { useEffect, useMemo, useState } from 'react';
import { Copy } from 'lucide-react';

import { GAMES, type GameId } from '@/lib/game-picker/games';
import type { GameCharacter, RoleDef } from '@/lib/game-picker/types';

const MATCH_UI = {
  ko: { mbti: '내 MBTI', game: '게임', fit: '찰떡 역할', same: '같은 역할 추천', copy: '결과 공유 문구 복사', copied: '복사됨', note: 'MBTI와 게임 역할을 재미로 연결한 결과예요. 실력과 취향이 더 중요해요!', match: '역할과 잘 맞아요.', tryRole: '역할로 새로운 플레이를 시도해 보세요.', share: '의 궁합' },
  en: { mbti: 'My MBTI', game: 'Game', fit: 'Best-fit role', same: 'More picks for this role', copy: 'Copy share text', copied: 'Copied', note: 'This is a fun MBTI-to-game match. Skill and preference matter more!', match: 'is a great fit for this role.', tryRole: 'Try a new play style with this role.', share: ' match' },
  ja: { mbti: '自分のMBTI', game: 'ゲーム', fit: '相性のよい役割', same: '同じ役割のおすすめ', copy: '共有文をコピー', copied: 'コピーしました', note: 'MBTIとゲーム役割を楽しく組み合わせた結果です。実力と好みがより大切です！', match: 'の役割と相性が良いです。', tryRole: 'この役割で新しいプレイを試してみましょう。', share: 'の相性' },
  zh: { mbti: '我的 MBTI', game: '游戏', fit: '最适合的定位', same: '同定位推荐', copy: '复制分享文案', copied: '已复制', note: '这是 MBTI 与游戏定位的趣味匹配，实力和喜好更重要！', match: '与该定位很匹配。', tryRole: '试试这个定位的新玩法吧。', share: '的匹配' },
  es: { mbti: 'Mi MBTI', game: 'Juego', fit: 'Rol ideal', same: 'Más recomendaciones para este rol', copy: 'Copiar texto para compartir', copied: 'Copiado', note: 'Es una combinación divertida entre MBTI y rol. ¡La habilidad y el gusto importan más!', match: 'encaja muy bien con este rol.', tryRole: 'Prueba un nuevo estilo con este rol.', share: ' combinación' },
  de: { mbti: 'Mein MBTI', game: 'Spiel', fit: 'Passende Rolle', same: 'Weitere Empfehlungen für diese Rolle', copy: 'Text zum Teilen kopieren', copied: 'Kopiert', note: 'Eine spielerische MBTI-Rollen-Zuordnung. Können und Vorlieben zählen mehr!', match: 'passt gut zu dieser Rolle.', tryRole: 'Probiere mit dieser Rolle einen neuen Spielstil.', share: '-Match' },
  fr: { mbti: 'Mon MBTI', game: 'Jeu', fit: 'Rôle idéal', same: 'Autres recommandations pour ce rôle', copy: 'Copier le texte à partager', copied: 'Copié', note: 'Une association ludique entre MBTI et rôle. Le talent et les préférences comptent davantage !', match: 'correspond bien à ce rôle.', tryRole: 'Essayez un nouveau style avec ce rôle.', share: ' : compatibilité' },
  pt: { mbti: 'Meu MBTI', game: 'Jogo', fit: 'Função ideal', same: 'Mais recomendações para esta função', copy: 'Copiar texto para compartilhar', copied: 'Copiado', note: 'Uma combinação divertida de MBTI e função. Habilidade e preferência importam mais!', match: 'combina bem com esta função.', tryRole: 'Experimente um novo estilo com esta função.', share: ' combinação' },
  vi: { mbti: 'MBTI của tôi', game: 'Trò chơi', fit: 'Vai trò phù hợp', same: 'Gợi ý khác cho vai trò này', copy: 'Sao chép nội dung chia sẻ', copied: 'Đã sao chép', note: 'Đây là kết quả ghép MBTI và vai trò để giải trí. Kỹ năng và sở thích quan trọng hơn!', match: 'rất hợp với vai trò này.', tryRole: 'Hãy thử lối chơi mới với vai trò này.', share: ' tương hợp' },
  id: { mbti: 'MBTI saya', game: 'Game', fit: 'Peran paling cocok', same: 'Rekomendasi lain untuk peran ini', copy: 'Salin teks untuk dibagikan', copied: 'Tersalin', note: 'Ini adalah pencocokan MBTI dan peran untuk hiburan. Kemampuan dan selera lebih penting!', match: 'sangat cocok dengan peran ini.', tryRole: 'Coba gaya bermain baru dengan peran ini.', share: ' cocok' }
} as const;

const getPathLocale = () => (typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'ko');

const MBTI_TYPES = ['ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP', 'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'];

// Short, original one-liners for each type's play style.
const MBTI_STYLE: Record<string, string> = {
  ISTJ: '정해진 플랜을 끝까지 지키는 안정형', ISFJ: '팀원 하나하나 챙기는 든든한 수비수', INFJ: '흐름을 먼저 읽는 조용한 설계자', INTJ: '이길 각을 계산하고 움직이는 전략가',
  ISTP: '침착하게 한 방을 노리는 해결사', ISFP: '감각으로 플레이하는 자유로운 아티스트', INFP: '팀 분위기를 지키는 다정한 서포터', INTP: '메커니즘을 파고드는 실험가',
  ESTP: '먼저 뛰어드는 과감한 승부사', ESFP: '하이라이트를 만드는 무대 체질', ENFP: '아이디어 넘치는 분위기 메이커', ENTP: '예상 밖의 수를 즐기는 변칙러',
  ESTJ: '콜을 잡고 팀을 정리하는 리더', ESFJ: '팀원 사기를 챙기는 응원단장', ENFJ: '모두를 이끌어 함께 이기는 리더', ENTJ: '판 전체를 지휘하는 사령관'
};

// Which MBTI letters lean toward each role; the role with the most matching letters wins.
const ROLE_LETTERS: Record<GameId, Record<string, string[]>> = {
  valorant: { duelist: ['E', 'T', 'P'], initiator: ['E', 'N', 'F'], controller: ['I', 'N', 'J'], sentinel: ['I', 'S', 'J'] },
  overwatch: { tank: ['E', 'S', 'J'], damage: ['T', 'P', 'N'], support: ['I', 'F', 'J'] },
  lol: { top: ['I', 'S', 'T'], jungle: ['E', 'N', 'P'], mid: ['E', 'N', 'T'], bot: ['I', 'T', 'J'], support: ['E', 'F', 'J'] }
};

const LETTER_TRAIT: Record<string, string> = {
  E: '먼저 움직이는 적극성', I: '혼자서도 흔들리지 않는 집중력', S: '눈앞 상황을 정확히 보는 현실 감각', N: '다음 수를 그리는 큰 그림',
  T: '냉정한 판단력', F: '팀원을 챙기는 공감력', J: '계획대로 굴리는 운영 능력', P: '상황에 맞춰 바꾸는 순발력'
};

const hash = (text: string) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const pickRole = (game: GameId, mbti: string) => {
  const table = ROLE_LETTERS[game];
  const scored = Object.entries(table).map(([role, letters]) => ({ role, letters: letters.filter((l) => mbti.includes(l)) }));
  const best = Math.max(...scored.map((s) => s.letters.length));
  const tied = scored.filter((s) => s.letters.length === best);
  return tied[hash(mbti + game) % tied.length];
};

export function MbtiGameMatch() {
  const ui = MATCH_UI[getPathLocale() as keyof typeof MATCH_UI] ?? MATCH_UI.en;
  const [mbti, setMbti] = useState('ENFP');
  const [game, setGame] = useState<GameId>('valorant');
  const [rosters, setRosters] = useState<Record<GameId, GameCharacter[]>>({ valorant: GAMES.valorant.fallback, overwatch: GAMES.overwatch.fallback, lol: GAMES.lol.fallback });
  const [copied, setCopied] = useState(false);
  const config = GAMES[game];

  useEffect(() => {
    config.load().then((list) => list.length && setRosters((prev) => ({ ...prev, [game]: list }))).catch(() => undefined);
  }, [game]);

  const match = useMemo(() => {
    const { role, letters } = pickRole(game, mbti);
    const roleDef = config.roles.find((r) => r.id === role) as RoleDef;
    // Sort by id first so the pick only depends on the MBTI, not on API ordering.
    const candidates = rosters[game].filter((c) => config.inRole(c, role)).sort((a, b) => a.id.localeCompare(b.id));
    const start = hash(mbti + role) % Math.max(1, candidates.length);
    const picks = [0, 1, 2].map((i) => candidates[(start + i * 7) % candidates.length]).filter(Boolean);
    return { roleDef, letters, picks: [...new Map(picks.map((p) => [p.id, p])).values()] };
  }, [game, mbti, rosters]);

  const main = match.picks[0];

  const copy = async () => {
    if (!main) return;
    try {
      await navigator.clipboard.writeText(`[ManyTool] ${mbti}${ui.share} ${config.unit}\n${match.roleDef.label} · ${main.name}\n${MBTI_STYLE[mbti]}\nmanytool.net/mbti-game-character`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-slate-800">{ui.mbti}</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {MBTI_TYPES.map((type) => (
            <button key={type} type="button" onClick={() => setMbti(type)} className={`rounded-2xl border py-3 text-sm font-black tracking-wide transition ${mbti === type ? 'border-violet-600 bg-violet-600 text-white shadow-md' : 'border-slate-200 bg-white text-slate-700 hover:border-violet-300'}`}>
              {type}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm font-bold text-slate-800">{ui.game}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {([['valorant', '🎯 발로란트'], ['overwatch', '🛡️ 오버워치'], ['lol', '⚔️ 리그 오브 레전드']] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setGame(id)} className={`rounded-full border px-4 py-2 text-sm font-bold transition ${game === id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}>
              {label}
            </button>
          ))}
        </div>
      </section>

      {main ? (
        <section className="overflow-hidden rounded-[28px] text-white shadow-sm" style={{ background: `radial-gradient(circle at 80% 0%, ${match.roleDef.color}66, transparent 55%), #0f172a` }}>
          <div className="flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-center">
            <div className="h-36 w-36 shrink-0 overflow-hidden rounded-[30px] border-4 shadow-xl" style={{ borderColor: match.roleDef.color, background: main.color ? `radial-gradient(circle at 50% 30%, ${main.color}, #0f172a)` : '#1e293b' }}>
              <img src={main.icon} alt={main.name} className="h-full w-full object-cover" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-sm font-black tracking-[0.2em] text-violet-300">{mbti}</p>
              <p className="mt-1 text-sm text-white/70">{MBTI_STYLE[mbti]}</p>
              <h2 className="mt-3 text-4xl font-black">{main.name}</h2>
              <p className="mt-1 text-sm font-bold" style={{ color: match.roleDef.color }}>{match.roleDef.emoji} {ui.fit} · {match.roleDef.label}</p>
            </div>
          </div>
          <div className="border-t border-white/10 bg-white/5 px-6 py-4 text-sm leading-6 text-white/80">
            <p>
              {match.letters.length
                ? `${match.letters.map((l) => LETTER_TRAIT[l]).join(', ')} ${match.roleDef.label} ${ui.match}`
                : `${match.roleDef.label} ${ui.tryRole}`}{' '}
              {match.roleDef.tip}
            </p>
          </div>
        </section>
      ) : null}

      {match.picks.length > 1 ? (
        <section className="rounded-[24px] border border-slate-200 bg-white p-5">
          <p className="text-sm font-black text-slate-900">{ui.same} · {config.unit}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {match.picks.slice(1).map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-2 pr-4">
                <img src={c.icon} alt="" className="h-12 w-12 rounded-xl bg-slate-800 object-cover" />
                <span className="text-sm font-bold text-slate-800">{c.name}</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={copy} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">
            <Copy className="h-4 w-4" /> {copied ? ui.copied : ui.copy}
          </button>
        </section>
      ) : null}
      <p className="text-center text-xs text-slate-400">{ui.note}</p>
    </div>
  );
}

export default MbtiGameMatch;
