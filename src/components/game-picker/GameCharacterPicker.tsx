import { useEffect, useMemo, useRef, useState } from 'react';
import { Dices, Eye, EyeOff, RotateCcw, Users, User } from 'lucide-react';

import { GAMES, type GameId } from '@/lib/game-picker/games';
import type { GameCharacter, RoleDef } from '@/lib/game-picker/types';

const ROLL_MS = 1300;
const HISTORY_LIMIT = 6;
const ANY_ROLE: RoleDef = { id: 'any', label: '자유', emoji: '🎲', color: '#64748B', tip: '팀에 부족한 역할을 보고 유연하게 골라 주세요.' };

type Pick = { slot: RoleDef; character: GameCharacter };

const storageKey = (game: GameId) => `manytool.gamePicker.${game}.excluded`;
const readExcluded = (game: GameId) => {
  try {
    return new Set<string>(JSON.parse(window.localStorage.getItem(storageKey(game)) || '[]'));
  } catch {
    return new Set<string>();
  }
};

const shuffle = <T,>(list: T[]) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const FACES: { n: number; transform: string }[] = [
  { n: 1, transform: 'rotateY(0deg)' },
  { n: 6, transform: 'rotateY(180deg)' },
  { n: 2, transform: 'rotateY(90deg)' },
  { n: 5, transform: 'rotateY(-90deg)' },
  { n: 3, transform: 'rotateX(90deg)' },
  { n: 4, transform: 'rotateX(-90deg)' }
];

function Dice({ rolling, accent }: { rolling: boolean; accent: string }) {
  return (
    <div className="gp-scene h-24 w-24" aria-hidden="true">
      <div className={`gp-cube ${rolling ? 'gp-rolling' : ''}`}>
        {FACES.map((face) => (
          <div key={face.n} className="gp-face" style={{ transform: `${face.transform} translateZ(48px)` }}>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="flex items-center justify-center">
                {PIPS[face.n].includes(i) ? <span className="h-3.5 w-3.5 rounded-full" style={{ background: face.n === 1 ? accent : '#0f172a' }} /> : null}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Portrait({ character, size = 112, ring }: { character: GameCharacter; size?: number; ring: string }) {
  return (
    <div className="overflow-hidden rounded-[28px] border-4 bg-slate-800 shadow-lg" style={{ width: size, height: size, borderColor: ring, background: character.color ? `radial-gradient(circle at 50% 30%, ${character.color}, #0f172a)` : undefined }}>
      <img src={character.icon} alt={character.name} className="h-full w-full object-cover" loading="lazy" />
    </div>
  );
}

type PickerLocale = 'ko' | 'en' | 'zh' | 'es' | 'de' | 'fr' | 'pt' | 'vi' | 'id' | 'it' | 'nl' | 'ru' | 'ar' | 'hi' | 'tr' | 'pl' | 'th' | 'sv' | 'uk';
const PICKER_UI = {
  ko: { role: '역할', all: '전체', pick: '랜덤 추천', team: '5인 조합', excluded: '제외 목록', clear: '제외 초기화' },
  en: { role: 'Role', all: 'All', pick: 'Pick randomly', team: 'Team of 5', excluded: 'Excluded', clear: 'Clear exclusions' },
  zh: { role: '角色', all: '全部', pick: '随机推荐', team: '五人组合', excluded: '排除列表', clear: '清除排除项' },
  es: { role: 'Rol', all: 'Todos', pick: 'Elegir al azar', team: 'Equipo de 5', excluded: 'Excluidos', clear: 'Limpiar exclusiones' },
  de: { role: 'Rolle', all: 'Alle', pick: 'Zufällig wählen', team: 'Team aus 5', excluded: 'Ausgeschlossen', clear: 'Ausschlüsse löschen' },
  fr: { role: 'Rôle', all: 'Tous', pick: 'Choisir au hasard', team: 'Équipe de 5', excluded: 'Exclus', clear: 'Effacer les exclusions' },
  pt: { role: 'Função', all: 'Todos', pick: 'Escolher aleatoriamente', team: 'Equipe de 5', excluded: 'Excluídos', clear: 'Limpar exclusões' },
  vi: { role: 'Vai trò', all: 'Tất cả', pick: 'Chọn ngẫu nhiên', team: 'Đội 5 người', excluded: 'Đã loại trừ', clear: 'Xóa danh sách loại trừ' },
  id: { role: 'Peran', all: 'Semua', pick: 'Pilih acak', team: 'Tim berisi 5', excluded: 'Dikecualikan', clear: 'Hapus pengecualian' },
  it: { role: 'Ruolo', all: 'Tutti', pick: 'Scegli a caso', team: 'Squadra da 5', excluded: 'Esclusi', clear: 'Cancella esclusioni' },
  nl: { role: 'Rol', all: 'Alle', pick: 'Willekeurig kiezen', team: 'Team van 5', excluded: 'Uitgesloten', clear: 'Uitsluitingen wissen' },
  ru: { role: 'Роль', all: 'Все', pick: 'Выбрать случайно', team: 'Команда из 5', excluded: 'Исключённые', clear: 'Сбросить исключения' },
  ar: { role: 'الدور', all: 'الكل', pick: 'اختيار عشوائي', team: 'فريق من 5', excluded: 'المستبعدون', clear: 'مسح الاستثناءات' },
  hi: { role: 'रोल', all: 'सभी', pick: 'रैंडम चुनें', team: '5 की टीम', excluded: 'हटाए गए', clear: 'हटाना रीसेट करें' },
  tr: { role: 'Rol', all: 'Tümü', pick: 'Rastgele seç', team: '5 kişilik takım', excluded: 'Hariç tutulanlar', clear: 'Hariç tutulanları temizle' },
  pl: { role: 'Rola', all: 'Wszystkie', pick: 'Wylosuj', team: 'Drużyna 5-osobowa', excluded: 'Wykluczone', clear: 'Wyczyść wykluczenia' },
  th: { role: 'บทบาท', all: 'ทั้งหมด', pick: 'สุ่มเลือก', team: 'ทีม 5 คน', excluded: 'รายการที่ยกเว้น', clear: 'ล้างรายการยกเว้น' },
  sv: { role: 'Roll', all: 'Alla', pick: 'Välj slumpmässigt', team: 'Lag med 5', excluded: 'Uteslutna', clear: 'Rensa undantag' },
  uk: { role: 'Роль', all: 'Усі', pick: 'Обрати випадково', team: 'Команда з 5', excluded: 'Виключені', clear: 'Очистити виключення' }
} as const;

const PICKER_EXTRA = {
  ko: { single: '1명 뽑기', team: '5인 팀 조합', style: '플레이 스타일', anyStyle: '상관없음', teamTitle: '팀 구성', teamHint: '겹치지 않게 역할별로 한 명씩 뽑아요.', roll: '주사위 굴리기', reroll: '다시 굴리기', rolling: '굴리는 중…', poolManage: '풀 관리', excludedCount: '명 제외', poolHint: '눌러서 없는 항목을 빼면 추천에서 제외돼요. 이 기기에 저장돼요.', includeAll: '모두 다시 포함', today: '오늘의', rollHint: '주사위를 굴려 랜덤으로 추천받아 보세요', drama: '두구두구…', teamResult: '오늘의 5인 조합', recent: '최근 뽑은' },
  en: { single: 'Pick 1', team: 'Team of 5', style: 'Play style', anyStyle: 'Any style', teamTitle: 'Team setup', teamHint: 'Pick one character for each role without duplicates.', roll: 'Roll the dice', reroll: 'Roll again', rolling: 'Rolling…', poolManage: 'Manage pool', excludedCount: ' excluded', poolHint: 'Tap a character to exclude it from recommendations. Saved on this device.', includeAll: 'Include all again', today: 'Today’s', rollHint: 'Roll the dice for a random recommendation', drama: 'Rolling…', teamResult: 'Today’s team of 5', recent: 'Recently picked' },
  zh: { single: '抽 1 名', team: '五人队伍', style: '玩法风格', anyStyle: '不限', teamTitle: '队伍配置', teamHint: '为每个位置选择一名不同的角色。', roll: '掷骰子', reroll: '再掷一次', rolling: '抽取中…', poolManage: '管理角色池', excludedCount: ' 人已排除', poolHint: '点击角色即可从推荐中排除，设置会保存在此设备。', includeAll: '全部重新加入', today: '今日', rollHint: '掷骰子获取随机推荐', drama: '揭晓中…', teamResult: '今日五人组合', recent: '最近抽取' },
  es: { single: 'Elegir 1', team: 'Equipo de 5', style: 'Estilo de juego', anyStyle: 'Cualquiera', teamTitle: 'Composición', teamHint: 'Elige un personaje por rol sin repetir.', roll: 'Tirar los dados', reroll: 'Tirar de nuevo', rolling: 'Sorteando…', poolManage: 'Gestionar lista', excludedCount: ' excluidos', poolHint: 'Pulsa un personaje para excluirlo. Se guarda en este dispositivo.', includeAll: 'Incluir todos', today: 'De hoy', rollHint: 'Tira los dados para una recomendación aleatoria', drama: 'Redoble…', teamResult: 'Equipo de 5 de hoy', recent: 'Elegidos recientemente' },
  de: { single: '1 auswählen', team: 'Team aus 5', style: 'Spielstil', anyStyle: 'Beliebig', teamTitle: 'Teamaufstellung', teamHint: 'Wähle pro Rolle einen Charakter ohne Duplikate.', roll: 'Würfeln', reroll: 'Erneut würfeln', rolling: 'Wird gewürfelt…', poolManage: 'Pool verwalten', excludedCount: ' ausgeschlossen', poolHint: 'Tippe auf einen Charakter, um ihn auszuschließen. Wird auf diesem Gerät gespeichert.', includeAll: 'Alle wieder einbeziehen', today: 'Heutiger', rollHint: 'Würfle für eine zufällige Empfehlung', drama: 'Trommelwirbel…', teamResult: 'Heutiges Team aus 5', recent: 'Zuletzt gewählt' },
  fr: { single: 'Choisir 1', team: 'Équipe de 5', style: 'Style de jeu', anyStyle: 'Tous styles', teamTitle: 'Composition', teamHint: 'Choisissez un personnage par rôle sans doublon.', roll: 'Lancer les dés', reroll: 'Relancer', rolling: 'Tirage…', poolManage: 'Gérer la liste', excludedCount: ' exclus', poolHint: 'Touchez un personnage pour l’exclure. Enregistré sur cet appareil.', includeAll: 'Tout réinclure', today: 'Le', rollHint: 'Lancez les dés pour une recommandation aléatoire', drama: 'Suspense…', teamResult: 'Équipe de 5 du jour', recent: 'Derniers choix' },
  pt: { single: 'Escolher 1', team: 'Equipe de 5', style: 'Estilo de jogo', anyStyle: 'Qualquer', teamTitle: 'Composição', teamHint: 'Escolha um personagem por função sem repetir.', roll: 'Rolar os dados', reroll: 'Rolar novamente', rolling: 'Sorteando…', poolManage: 'Gerenciar lista', excludedCount: ' excluídos', poolHint: 'Toque em um personagem para excluí-lo. Salvo neste dispositivo.', includeAll: 'Incluir todos', today: 'De hoje', rollHint: 'Role os dados para uma recomendação aleatória', drama: 'Suspense…', teamResult: 'Equipe de 5 de hoje', recent: 'Escolhidos recentemente' },
  vi: { single: 'Chọn 1', team: 'Đội 5 người', style: 'Phong cách chơi', anyStyle: 'Bất kỳ', teamTitle: 'Đội hình', teamHint: 'Chọn một nhân vật cho mỗi vai trò, không trùng lặp.', roll: 'Tung xúc xắc', reroll: 'Tung lại', rolling: 'Đang chọn…', poolManage: 'Quản lý danh sách', excludedCount: ' đã loại', poolHint: 'Chạm vào nhân vật để loại khỏi gợi ý. Được lưu trên thiết bị này.', includeAll: 'Thêm lại tất cả', today: 'Hôm nay', rollHint: 'Tung xúc xắc để nhận gợi ý ngẫu nhiên', drama: 'Đang hồi hộp…', teamResult: 'Đội 5 người hôm nay', recent: 'Đã chọn gần đây' },
  id: { single: 'Pilih 1', team: 'Tim berisi 5', style: 'Gaya bermain', anyStyle: 'Apa saja', teamTitle: 'Susunan tim', teamHint: 'Pilih satu karakter untuk tiap peran tanpa duplikat.', roll: 'Lempar dadu', reroll: 'Lempar lagi', rolling: 'Memilih…', poolManage: 'Kelola daftar', excludedCount: ' dikecualikan', poolHint: 'Ketuk karakter untuk mengecualikannya. Tersimpan di perangkat ini.', includeAll: 'Sertakan semua lagi', today: 'Hari ini', rollHint: 'Lempar dadu untuk rekomendasi acak', drama: 'Menegangkan…', teamResult: 'Tim 5 hari ini', recent: 'Pilihan terbaru' },
} as const;

const ROLE_LABELS = {
  it: { any: 'Libero', duelist: 'Duellante', initiator: 'Iniziatore', controller: 'Controllore', sentinel: 'Sentinella' },
  nl: { any: 'Vrij', duelist: 'Duelist', initiator: 'Initiator', controller: 'Controller', sentinel: 'Sentinel' },
  ru: { any: 'Любая', duelist: 'Дуэлянт', initiator: 'Зачинщик', controller: 'Контроллер', sentinel: 'Страж' },
  ar: { any: 'حر', duelist: 'مبارز', initiator: 'مبادر', controller: 'متحكم', sentinel: 'حارس' },
  hi: { any: 'कोई भी', duelist: 'ड्यूलिस्ट', initiator: 'इनिशिएटर', controller: 'कंट्रोलर', sentinel: 'सेंटिनल' },
  tr: { any: 'Serbest', duelist: 'Düellocu', initiator: 'Öncü', controller: 'Kontrol Uzmanı', sentinel: 'Nöbetçi' },
  pl: { any: 'Dowolna', duelist: 'Duelista', initiator: 'Inicjator', controller: 'Kontroler', sentinel: 'Strażnik' },
  th: { any: 'อิสระ', duelist: 'ดูเอลลิสต์', initiator: 'ผู้ริเริ่ม', controller: 'คอนโทรลเลอร์', sentinel: 'เซนทิเนล' },
  sv: { any: 'Valfri', duelist: 'Duellant', initiator: 'Initiativtagare', controller: 'Kontrollant', sentinel: 'Väktare' },
  uk: { any: 'Будь-яка', duelist: 'Дуаліст', initiator: 'Ініціатор', controller: 'Контролер', sentinel: 'Вартовий' }
} as const;

const ROLE_TIPS = {
  it: 'Scegli questo ruolo in base al tuo stile di gioco e alle esigenze della squadra.',
  nl: 'Kies deze rol op basis van je speelstijl en wat je team nodig heeft.',
  ru: 'Выбирайте эту роль с учётом своего стиля игры и потребностей команды.',
  ar: 'اختر هذا الدور وفقاً لأسلوب لعبك واحتياجات الفريق.',
  hi: 'अपनी खेल शैली और टीम की ज़रूरत के अनुसार यह रोल चुनें।',
  tr: 'Bu rolü oyun tarzınıza ve takımınızın ihtiyacına göre seçin.',
  pl: 'Wybierz tę rolę zgodnie ze swoim stylem gry i potrzebami drużyny.',
  th: 'เลือกบทบาทนี้ตามสไตล์การเล่นและความต้องการของทีม',
  sv: 'Välj rollen efter din spelstil och lagets behov.',
  uk: 'Обирайте цю роль відповідно до свого стилю гри та потреб команди.'
} as const;

export function GameCharacterPicker({ game, locale = 'ko' }: { game: GameId; locale?: PickerLocale }) {
  const ui = PICKER_UI[locale] ?? PICKER_UI.en;
  const extra = PICKER_EXTRA[locale as keyof typeof PICKER_EXTRA] ?? PICKER_EXTRA.en;
  const roleLabels = ROLE_LABELS[locale as keyof typeof ROLE_LABELS];
  const roleLabel = (role: RoleDef) => roleLabels?.[role.id as keyof typeof roleLabels] ?? role.label;
  const roleTip = (role: RoleDef) => ROLE_TIPS[locale as keyof typeof ROLE_TIPS] ?? role.tip;
  const config = GAMES[game];
  const [roster, setRoster] = useState<GameCharacter[]>(config.fallback);
  const [rosterNote, setRosterNote] = useState(locale === 'ko' ? '최신 목록을 불러오는 중…' : 'Loading the latest list…');
  const [role, setRole] = useState<string>('all');
  const [style, setStyle] = useState<string>('all');
  const [mode, setMode] = useState<'single' | 'team'>('single');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [showPool, setShowPool] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [ticker, setTicker] = useState<GameCharacter | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [history, setHistory] = useState<GameCharacter[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    setExcluded(readExcluded(game));
    config.load()
      .then((list) => {
        if (list.length) setRoster(list);
        setRosterNote(locale === 'ko' ? `${list.length}명 ${config.unit} 최신 목록` : `${list.length} ${config.unit} in the latest list`);
      })
      .catch(() => setRosterNote(locale === 'ko' ? `${config.fallback.length}명 ${config.unit} (기본 목록)` : `${config.fallback.length} ${config.unit} (default list)`));
    return () => timers.current.forEach((id) => window.clearTimeout(id));
  }, [game]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey(game), JSON.stringify([...excluded]));
    } catch {
      // Exclusions are a convenience; without storage they just reset on reload.
    }
  }, [excluded, game]);

  const roleById = (id: string) => config.roles.find((r) => r.id === id) ?? ANY_ROLE;
  const styleTags = config.styles?.find((s) => s.id === style)?.tags;
  const available = useMemo(() => roster.filter((c) => !excluded.has(c.id)), [roster, excluded]);
  const pool = useMemo(
    () => available.filter((c) => (role === 'all' || config.inRole(c, role)) && (!styleTags || styleTags.some((t) => c.tags?.includes(t)))),
    [available, role, styleTags]
  );

  const drawTeam = (): Pick[] => {
    const used = new Set<string>();
    return config.team.map((slotId) => {
      const slot = roleById(slotId);
      const candidates = shuffle(available.filter((c) => !used.has(c.id) && (slotId === 'any' || config.inRole(c, slotId))));
      const character = candidates[0] ?? shuffle(available.filter((c) => !used.has(c.id)))[0] ?? available[0];
      if (character) used.add(character.id);
      return { slot, character };
    }).filter((p) => p.character);
  };

  const roll = () => {
    const source = mode === 'single' ? pool : available;
    if (!source.length || rolling) return;
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    setRolling(true);
    setPicks([]);
    // Slot-machine ticker that slows down toward the end of the roll.
    let elapsed = 0;
    let step = 55;
    while (elapsed < ROLL_MS - 120) {
      elapsed += step;
      step = Math.round(step * 1.12);
      timers.current.push(window.setTimeout(() => setTicker(source[Math.floor(Math.random() * source.length)]), elapsed));
    }
    timers.current.push(window.setTimeout(() => {
      let result: Pick[];
      if (mode === 'single') {
        const character = shuffle(source)[0];
        // With no role filter, label the pick with the first role it fits (LoL places champions by tags).
        const slot = role !== 'all' ? roleById(role) : config.roles.find((r) => config.inRole(character, r.id)) ?? ANY_ROLE;
        result = [{ slot, character }];
      } else {
        result = drawTeam();
      }
      setPicks(result);
      setTicker(null);
      setRolling(false);
      setHistory((prev) => [...result.map((p) => p.character), ...prev].slice(0, HISTORY_LIMIT));
    }, ROLL_MS));
  };

  const toggleExcluded = (id: string) => setExcluded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const single = mode === 'single' ? picks[0] : undefined;

  return (
    <div className="space-y-5">
      <style>{`
        .gp-scene { perspective: 600px; }
        .gp-cube { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transform: rotateX(-24deg) rotateY(32deg); transition: transform .4s ease; }
        .gp-rolling { animation: gp-roll ${ROLL_MS}ms cubic-bezier(.2,.7,.3,1); }
        .gp-face { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); padding: 14px; border-radius: 20px; background: linear-gradient(145deg, #ffffff, #e2e8f0); box-shadow: inset 0 0 0 2px rgba(15,23,42,.08); backface-visibility: hidden; }
        @keyframes gp-roll {
          0% { transform: rotateX(-24deg) rotateY(32deg); }
          100% { transform: rotateX(${720 - 24}deg) rotateY(${1080 + 32}deg) rotateZ(360deg); }
        }
        @media (prefers-reduced-motion: reduce) { .gp-rolling { animation-duration: 1ms; } }
      `}</style>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 text-sm font-bold">
            {([['single', extra.single, User], ['team', extra.team, Users]] as const).map(([value, label, Icon]) => (
              <button key={value} type="button" onClick={() => { setMode(value); setPicks([]); }} className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition ${mode === value ? 'bg-white text-slate-950 shadow' : 'text-slate-500'}`}>
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {mode === 'single' ? (
            <>
              <div>
              <p className="text-sm font-bold text-slate-800">{game === 'lol' && locale === 'ko' ? '포지션' : ui.role}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[{ id: 'all', label: ui.all, emoji: '🎲', color: '#0f172a' }, ...config.roles].map((r) => (
                    <button key={r.id} type="button" onClick={() => setRole(r.id)} className={`rounded-full border px-3.5 py-2 text-sm font-bold transition ${role === r.id ? 'text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`} style={role === r.id ? { background: r.color, borderColor: r.color } : undefined}>
                      {r.emoji} {r.label}
                    </button>
                  ))}
                </div>
              </div>
              {config.styles ? (
                <div>
                  <p className="text-sm font-bold text-slate-800">{extra.style}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[{ id: 'all', label: extra.anyStyle }, ...config.styles].map((s) => (
                      <button key={s.id} type="button" onClick={() => setStyle(s.id)} className={`rounded-full border px-3.5 py-2 text-sm font-bold transition ${style === s.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
              <p className="font-bold text-slate-800">{extra.teamTitle}</p>
              <p className="mt-1">{config.team.map((id) => `${roleById(id).emoji} ${roleById(id).label}`).join(' · ')}</p>
              <p className="mt-1 text-xs text-slate-400">{extra.teamHint}</p>
            </div>
          )}

          <button
            type="button"
            onClick={roll}
            disabled={rolling || !(mode === 'single' ? pool.length : available.length)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-base font-black text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${config.accent}, #0f172a)` }}
          >
            <Dices className="h-5 w-5" />
            {rolling ? extra.rolling : picks.length ? extra.reroll : extra.roll}
          </button>
          <p className="text-center text-xs text-slate-400">
            {mode === 'single' ? `${pool.length} · ${ui.all}` : `${available.length} · ${extra.teamTitle}`} · {rosterNote}
          </p>

          <div className="rounded-2xl border border-slate-200 p-3">
            <button type="button" onClick={() => setShowPool((v) => !v)} className="flex w-full items-center justify-between text-sm font-bold text-slate-800">
              <span>{config.unit} {extra.poolManage} {excluded.size ? <span className="text-rose-500">({excluded.size}{extra.excludedCount})</span> : null}</span>
              {showPool ? <EyeOff className="h-4 w-4 text-slate-400" /> : <Eye className="h-4 w-4 text-slate-400" />}
            </button>
            {showPool ? (
              <>
                <p className="mt-1 text-xs text-slate-500">{extra.poolHint}</p>
                <div className="mt-3 grid max-h-64 grid-cols-6 gap-1.5 overflow-y-auto sm:grid-cols-8">
                  {roster.map((c) => {
                    const off = excluded.has(c.id);
                    return (
                      <button key={c.id} type="button" onClick={() => toggleExcluded(c.id)} title={c.name} className={`overflow-hidden rounded-xl border-2 transition ${off ? 'border-transparent opacity-30 grayscale' : 'border-emerald-400'}`}>
                        <img src={c.icon} alt={c.name} loading="lazy" className="aspect-square w-full bg-slate-800 object-cover" />
                      </button>
                    );
                  })}
                </div>
                {excluded.size ? (
                  <button type="button" onClick={() => setExcluded(new Set())} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900">
                    <RotateCcw className="h-3.5 w-3.5" /> {extra.includeAll}
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <div className="relative flex min-h-[380px] flex-col items-center justify-center overflow-hidden rounded-[28px] p-6 text-center text-white shadow-sm" style={{ background: `radial-gradient(circle at 50% 0%, ${config.accent}55, transparent 55%), #0f172a` }}>
          {rolling || !picks.length ? (
            <>
              <Dice rolling={rolling} accent={config.accent} />
              <p className="mt-6 min-h-[2.5rem] text-3xl font-black tracking-tight">{rolling ? ticker?.name ?? '…' : `${extra.today} ${config.unit}`}</p>
              <p className="mt-2 text-sm text-white/60">{rolling ? extra.drama : extra.rollHint}</p>
            </>
          ) : single ? (
            <div className="flex flex-col items-center">
              <Portrait character={single.character} size={144} ring={single.slot.color} />
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: single.slot.color }}>{single.slot.emoji} {roleLabel(single.slot)}</p>
              <h2 className="mt-1 text-4xl font-black">{single.character.name}</h2>
              {single.character.en && single.character.en !== single.character.name ? <p className="text-sm text-white/50">{single.character.en}</p> : null}
              <p className="mt-4 max-w-sm text-sm leading-6 text-white/75">{roleTip(single.slot)}</p>
            </div>
          ) : (
            <div className="w-full">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">{extra.teamResult}</p>
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {picks.map((p, i) => (
                  <div key={`${p.character.id}-${i}`} className="flex flex-col items-center">
                    <Portrait character={p.character} size={76} ring={p.slot.color} />
                    <p className="mt-2 text-[11px] font-bold" style={{ color: p.slot.color }}>{p.slot.emoji} {roleLabel(p.slot)}</p>
                    <p className="text-sm font-black">{p.character.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {history.length ? (
        <section className="rounded-[24px] border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold text-slate-800">{extra.recent} {config.unit}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {history.map((c, i) => (
              <span key={`${c.id}-${i}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-3 text-sm font-semibold text-slate-700">
                <img src={c.icon} alt="" className="h-7 w-7 rounded-full bg-slate-800 object-cover" />
                {c.name}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default GameCharacterPicker;
