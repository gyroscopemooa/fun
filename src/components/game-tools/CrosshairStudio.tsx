import { useRef, useState } from 'react';
import { Copy, Download } from 'lucide-react';

import { saveNodeAsPng } from '@/lib/save-node-as-png';

type Crosshair = {
  size: number;
  thickness: number;
  gap: number;
  color: string;
  outline: boolean;
  outlineThickness: number;
  dot: boolean;
  dotSize: number;
  opacity: number;
  tShape: boolean;
};

const DEFAULT: Crosshair = { size: 6, thickness: 2, gap: 3, color: '#00FF88', outline: true, outlineThickness: 1, dot: false, dotSize: 2, opacity: 100, tShape: false };

const PRESETS: { name: string; value: Partial<Crosshair> }[] = [
  { name: '기본 십자', value: { size: 6, thickness: 2, gap: 3, color: '#00FF88', dot: false, tShape: false } },
  { name: '작은 점', value: { size: 0, thickness: 2, gap: 0, color: '#00FFFF', dot: true, dotSize: 3, tShape: false } },
  { name: '얇은 정밀', value: { size: 4, thickness: 1, gap: 2, color: '#FFFFFF', dot: true, dotSize: 1, tShape: false } },
  { name: '굵은 가독성', value: { size: 8, thickness: 3, gap: 4, color: '#FFFF00', dot: false, tShape: false } },
  { name: 'T자', value: { size: 6, thickness: 2, gap: 3, color: '#FF00FF', dot: true, dotSize: 2, tShape: true } }
];

const SCENES = [
  { id: 'desert', label: '사막', background: 'linear-gradient(180deg,#f4c98a 0%,#d99a5b 55%,#8a5a2b 100%)' },
  { id: 'night', label: '야간', background: 'linear-gradient(180deg,#0f172a 0%,#1e3a8a 60%,#0b1120 100%)' },
  { id: 'grass', label: '숲', background: 'linear-gradient(180deg,#bae6fd 0%,#4ade80 55%,#166534 100%)' },
  { id: 'snow', label: '설원', background: 'linear-gradient(180deg,#f8fafc 0%,#e2e8f0 55%,#94a3b8 100%)' }
];

const SCENE_LABELS = {
  it: { desert: 'Deserto', night: 'Notte', grass: 'Foresta', snow: 'Neve' },
  nl: { desert: 'Woestijn', night: 'Nacht', grass: 'Bos', snow: 'Sneeuw' },
  ru: { desert: 'Пустыня', night: 'Ночь', grass: 'Лес', snow: 'Снег' },
  ar: { desert: 'الصحراء', night: 'الليل', grass: 'الغابة', snow: 'الثلج' },
  hi: { desert: 'रेगिस्तान', night: 'रात', grass: 'जंगल', snow: 'बर्फ़' },
  tr: { desert: 'Çöl', night: 'Gece', grass: 'Orman', snow: 'Kar' },
  pl: { desert: 'Pustynia', night: 'Noc', grass: 'Las', snow: 'Śnieg' },
  th: { desert: 'ทะเลทราย', night: 'กลางคืน', grass: 'ป่า', snow: 'หิมะ' },
  sv: { desert: 'Öken', night: 'Natt', grass: 'Skog', snow: 'Snö' },
  uk: { desert: 'Пустеля', night: 'Ніч', grass: 'Ліс', snow: 'Сніг' }
} as const;

function Reticle({ c, scale = 4 }: { c: Crosshair; scale?: number }) {
  const s = c.size * scale;
  const t = Math.max(1, c.thickness * scale * 0.5);
  const g = c.gap * scale * 0.6;
  const o = c.outline ? Math.max(1, c.outlineThickness * scale * 0.5) : 0;
  const base = { background: c.color, boxShadow: o ? `0 0 0 ${o}px #000` : 'none', position: 'absolute' as const };
  const arms = [
    { left: -t / 2, top: -g - s, width: t, height: s, hidden: c.tShape },
    { left: -t / 2, top: g, width: t, height: s },
    { left: -g - s, top: -t / 2, width: s, height: t },
    { left: g, top: -t / 2, width: s, height: t }
  ];
  return (
    <div className="relative h-0 w-0" style={{ opacity: c.opacity / 100 }}>
      {c.size > 0 ? arms.filter((a) => !a.hidden).map((a, i) => <span key={i} style={{ ...base, left: a.left, top: a.top, width: a.width, height: a.height }} />) : null}
      {c.dot ? <span style={{ ...base, left: -(c.dotSize * scale) / 2, top: -(c.dotSize * scale) / 2, width: c.dotSize * scale, height: c.dotSize * scale }} /> : null}
    </div>
  );
}

const settingsText = (c: Crosshair) => [
  `색상 ${c.color}`,
  `길이 ${c.size} · 두께 ${c.thickness} · 간격 ${c.gap}`,
  `외곽선 ${c.outline ? `켬 (${c.outlineThickness})` : '끔'}`,
  `중앙점 ${c.dot ? `켬 (${c.dotSize})` : '끔'}`,
  `투명도 ${c.opacity}%${c.tShape ? ' · T자' : ''}`
];

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex justify-between text-sm font-bold text-slate-800"><span>{label}</span><span className="text-slate-500">{value}</span></span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-slate-900" />
    </label>
  );
}

type CrosshairLocale = 'ko' | 'en' | 'zh' | 'es' | 'de' | 'fr' | 'pt' | 'vi' | 'id' | 'it' | 'nl' | 'ru' | 'ar' | 'hi' | 'tr' | 'pl' | 'th' | 'sv' | 'uk';
const UI_COPY = {
  ko: { preset: '프리셋', copy: '설정값 복사', save: 'PNG로 저장', saving: '이미지 만드는 중…', card: '크로스헤어 공유 카드' },
  en: { preset: 'Presets', copy: 'Copy settings', save: 'Save PNG', saving: 'Creating image…', card: 'Crosshair share card' },
  zh: { preset: '预设', copy: '复制设置', save: '保存 PNG', saving: '正在生成图片…', card: '准星分享卡片' },
  es: { preset: 'Preajustes', copy: 'Copiar ajustes', save: 'Guardar PNG', saving: 'Creando imagen…', card: 'Tarjeta para compartir' },
  de: { preset: 'Voreinstellungen', copy: 'Einstellungen kopieren', save: 'PNG speichern', saving: 'Bild wird erstellt…', card: 'Fadenkreuz-Karte' },
  fr: { preset: 'Préréglages', copy: 'Copier les réglages', save: 'Enregistrer PNG', saving: 'Création de l’image…', card: 'Carte de partage' },
  pt: { preset: 'Predefinições', copy: 'Copiar configurações', save: 'Salvar PNG', saving: 'Criando imagem…', card: 'Cartão para compartilhar' },
  vi: { preset: 'Mẫu có sẵn', copy: 'Sao chép cài đặt', save: 'Lưu PNG', saving: 'Đang tạo ảnh…', card: 'Thẻ chia sẻ tâm ngắm' },
  id: { preset: 'Preset', copy: 'Salin pengaturan', save: 'Simpan PNG', saving: 'Membuat gambar…', card: 'Kartu berbagi crosshair' },
  it: { preset: 'Preimpostazioni', copy: 'Copia impostazioni', save: 'Salva PNG', saving: 'Creazione immagine…', card: 'Scheda mirino da condividere' },
  nl: { preset: 'Voorinstellingen', copy: 'Instellingen kopiëren', save: 'PNG opslaan', saving: 'Afbeelding maken…', card: 'Deelkaart voor vizier' },
  ru: { preset: 'Пресеты', copy: 'Копировать настройки', save: 'Сохранить PNG', saving: 'Создание изображения…', card: 'Карточка прицела' },
  ar: { preset: 'إعدادات مسبقة', copy: 'نسخ الإعدادات', save: 'حفظ PNG', saving: 'جارٍ إنشاء الصورة…', card: 'بطاقة مشاركة التصويب' },
  hi: { preset: 'प्रीसेट', copy: 'सेटिंग कॉपी करें', save: 'PNG सेव करें', saving: 'इमेज बनाई जा रही है…', card: 'क्रॉसहेयर शेयर कार्ड' },
  tr: { preset: 'Ön ayarlar', copy: 'Ayarları kopyala', save: 'PNG kaydet', saving: 'Görsel oluşturuluyor…', card: 'Nişangâh paylaşım kartı' },
  pl: { preset: 'Presety', copy: 'Kopiuj ustawienia', save: 'Zapisz PNG', saving: 'Tworzenie obrazu…', card: 'Karta celownika' },
  th: { preset: 'ค่าที่ตั้งไว้', copy: 'คัดลอกการตั้งค่า', save: 'บันทึก PNG', saving: 'กำลังสร้างรูปภาพ…', card: 'การ์ดแชร์เป้าเล็ง' },
  sv: { preset: 'Förinställningar', copy: 'Kopiera inställningar', save: 'Spara PNG', saving: 'Skapar bild…', card: 'Delningskort för sikte' },
  uk: { preset: 'Пресети', copy: 'Копіювати налаштування', save: 'Зберегти PNG', saving: 'Створення зображення…', card: 'Картка прицілу' }
} as const;

const STATUS_COPY = {
  en: { copied: 'Settings copied.', copyFailed: 'Could not copy settings.', saveFailed: 'Could not save the image.' },
  it: { copied: 'Impostazioni copiate.', copyFailed: 'Impossibile copiare le impostazioni.', saveFailed: 'Impossibile salvare l’immagine.' },
  nl: { copied: 'Instellingen gekopieerd.', copyFailed: 'Instellingen kopiëren mislukt.', saveFailed: 'Afbeelding opslaan mislukt.' },
  ru: { copied: 'Настройки скопированы.', copyFailed: 'Не удалось скопировать настройки.', saveFailed: 'Не удалось сохранить изображение.' },
  ar: { copied: 'تم نسخ الإعدادات.', copyFailed: 'تعذر نسخ الإعدادات.', saveFailed: 'تعذر حفظ الصورة.' },
  hi: { copied: 'सेटिंग कॉपी हो गई।', copyFailed: 'सेटिंग कॉपी नहीं हो सकी।', saveFailed: 'इमेज सेव नहीं हो सकी।' },
  tr: { copied: 'Ayarlar kopyalandı.', copyFailed: 'Ayarlar kopyalanamadı.', saveFailed: 'Görsel kaydedilemedi.' },
  pl: { copied: 'Ustawienia skopiowane.', copyFailed: 'Nie udało się skopiować ustawień.', saveFailed: 'Nie udało się zapisać obrazu.' },
  th: { copied: 'คัดลอกการตั้งค่าแล้ว', copyFailed: 'คัดลอกการตั้งค่าไม่สำเร็จ', saveFailed: 'บันทึกรูปภาพไม่สำเร็จ' },
  sv: { copied: 'Inställningarna kopierades.', copyFailed: 'Det gick inte att kopiera inställningarna.', saveFailed: 'Det gick inte att spara bilden.' },
  uk: { copied: 'Налаштування скопійовано.', copyFailed: 'Не вдалося скопіювати налаштування.', saveFailed: 'Не вдалося зберегти зображення.' }
} as const;

export function CrosshairStudio({ locale = 'ko' }: { locale?: CrosshairLocale }) {
  const copyText = UI_COPY[locale] ?? UI_COPY.en;
  const statusText = STATUS_COPY[locale as keyof typeof STATUS_COPY] ?? { copied: '설정값을 복사했습니다.', copyFailed: '복사하지 못했어요.', saveFailed: '이미지 저장에 실패했어요.' };
  const sceneLabels = SCENE_LABELS[locale as keyof typeof SCENE_LABELS];
  const [c, setC] = useState<Crosshair>(DEFAULT);
  const [scene, setScene] = useState(SCENES[1]);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<Crosshair>) => setC((prev) => ({ ...prev, ...patch }));

  const copy = async () => {
    try {
      // Same key=value format as the original generator, followed by the readable summary.
      await navigator.clipboard.writeText(`size=${c.size}; thickness=${c.thickness}; gap=${c.gap}; color=${c.color}; outline=${c.outline ? c.outlineThickness : 0}; dot=${c.dot ? c.dotSize : 0}; opacity=${c.opacity}${c.tShape ? '; t=1' : ''}\n${settingsText(c).join('\n')}`);
      setStatus(statusText.copied);
    } catch {
      setStatus(statusText.copyFailed);
    }
  };

  const save = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      await saveNodeAsPng(cardRef.current, 'manytool-crosshair.png');
    } catch {
      setStatus(statusText.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-bold text-slate-800">{copyText.preset}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.name} type="button" onClick={() => set(p.value)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-slate-900">{p.name}</button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Slider label="길이" value={c.size} min={0} max={20} onChange={(v) => set({ size: v })} />
            <Slider label="두께" value={c.thickness} min={1} max={8} onChange={(v) => set({ thickness: v })} />
            <Slider label="간격" value={c.gap} min={0} max={12} onChange={(v) => set({ gap: v })} />
            <Slider label="투명도" value={c.opacity} min={20} max={100} onChange={(v) => set({ opacity: v })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800">색상
              <input type="color" value={c.color} onChange={(e) => set({ color: e.target.value.toUpperCase() })} className="h-9 w-16 cursor-pointer rounded" />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800">T자 모양
              <input type="checkbox" checked={c.tShape} onChange={(e) => set({ tShape: e.target.checked })} className="h-5 w-5 accent-slate-900" />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800">외곽선
              <span className="flex items-center gap-2">
                <input type="number" min={1} max={3} value={c.outlineThickness} onChange={(e) => set({ outlineThickness: Math.max(1, Math.min(3, Number(e.target.value) || 1)) })} disabled={!c.outline} className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-sm font-normal" />
                <input type="checkbox" checked={c.outline} onChange={(e) => set({ outline: e.target.checked })} className="h-5 w-5 accent-slate-900" />
              </span>
            </label>
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800">중앙점
              <span className="flex items-center gap-2">
                <input type="number" min={1} max={6} value={c.dotSize} onChange={(e) => set({ dotSize: Math.max(1, Math.min(6, Number(e.target.value) || 1)) })} disabled={!c.dot} className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-sm font-normal" />
                <input type="checkbox" checked={c.dot} onChange={(e) => set({ dot: e.target.checked })} className="h-5 w-5 accent-slate-900" />
              </span>
            </label>
          </div>
          <button type="button" onClick={copy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 font-bold text-white">
            <Copy className="h-4 w-4" /> {copyText.copy}
          </button>
          {status ? <p className="text-sm text-slate-500">{status}</p> : null}
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            {SCENES.map((s) => (
              <button key={s.id} type="button" onClick={() => setScene(s)} className={`flex-1 rounded-xl border-2 py-2 text-xs font-bold ${scene.id === s.id ? 'border-slate-900' : 'border-transparent'}`} style={{ background: s.background, color: s.id === 'night' ? '#fff' : '#0f172a' }}>
                {sceneLabels?.[s.id as keyof typeof sceneLabels] ?? s.label}
              </button>
            ))}
          </div>
          <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-[24px] shadow-inner" style={{ background: scene.background }}>
            <div className="absolute inset-x-0 bottom-[30%] h-px bg-black/10" />
            <div className="absolute bottom-[30%] left-[20%] h-16 w-10 rounded-t-md bg-black/25" />
            <div className="absolute bottom-[30%] right-[22%] h-24 w-16 rounded-t-md bg-black/20" />
            <Reticle c={c} scale={4} />
          </div>
          <p className="text-xs text-slate-400">게임 화면처럼 배경을 바꿔 가며 잘 보이는지 확인해 보세요.</p>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-lg font-black text-slate-900">{copyText.card}</h2>
        <p className="text-xs text-slate-500">친구나 커뮤니티에 공유하기 좋은 1080×1080 이미지로 저장돼요.</p>
        <div className="mt-4 flex flex-col items-center gap-4 md:flex-row md:items-start">
          <div className="max-w-full overflow-auto rounded-[20px] shadow-xl max-[419px]:[zoom:0.8]">
            <div ref={cardRef} className="flex h-[360px] w-[360px] flex-col bg-slate-950 p-5 text-white">
              <div className="flex items-center justify-between text-[11px] font-black tracking-[0.25em]">
                <span style={{ color: c.color }}>MY CROSSHAIR</span>
                <span className="text-white/50">ManyTool</span>
              </div>
              <div className="mt-3 flex h-[170px] items-center justify-center rounded-2xl" style={{ background: scene.background }}>
                <Reticle c={c} scale={5} />
              </div>
              <ul className="mt-3 space-y-0.5 text-[12px] text-white/80">
                {settingsText(c).map((line) => <li key={line}>• {line}</li>)}
              </ul>
              <p className="mt-auto text-right text-[10px] font-bold text-white/40">manytool.net/crosshair-generator</p>
            </div>
          </div>
          <button type="button" onClick={save} disabled={saving} className="inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
            <Download className="h-4 w-4" /> {saving ? copyText.saving : copyText.save}
          </button>
        </div>
      </section>
    </div>
  );
}

export default CrosshairStudio;
