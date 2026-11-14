export const HEADSHOT_VERSION = '2026-11-15-v1';
export const HEADSHOT_CHOICES = Object.freeze({
  purpose: ['business', 'resume', 'social'],
  background: ['gray', 'ivory', 'blue', 'white'],
  expression: ['neutral', 'smile'],
  framing: ['shoulders', 'upper'],
  ratio: ['portrait', 'square'],
  retouch: ['off', 'light']
});
export function normalizeHeadshotOptions(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Object.assign(new Error('invalid profile options'), {statusCode:400});
  const defaults = {purpose:'business',background:'gray',expression:'smile',framing:'shoulders',ratio:'portrait',retouch:'light'};
  for (const key of Object.keys(input)) if (!Object.hasOwn(defaults,key)) throw Object.assign(new Error('unknown profile option'), {statusCode:400});
  const options = {...defaults,...input};
  for (const [key,values] of Object.entries(HEADSHOT_CHOICES)) if (!values.includes(options[key])) throw Object.assign(new Error(`invalid profile ${key}`), {statusCode:400});
  return options;
}
export function headshotPrompt(input) {
  const o=normalizeHeadshotOptions(input);
  return [
    {business:'Professional company and LinkedIn portrait: confident, approachable, contemporary studio photography.',resume:'Professional job application portrait: polished, calm, reliable and realistic.',social:'Personal social profile portrait: relaxed, friendly, modern editorial photography.'}[o.purpose],
    {gray:'Use a soft light gray seamless studio background.',ivory:'Use a warm ivory seamless studio background.',blue:'Use a muted slate blue seamless studio background.',white:'Use a plain white studio background.'}[o.background],
    o.expression==='smile'?'A gentle natural smile; preserve the real shape of the mouth.':'A calm neutral expression, relaxed closed mouth.',
    o.framing==='upper'?'Frame from the chest upward with both shoulders, generous breathing room and a natural posture.':'Frame the head and shoulders, with breathing room above the head; do not use a tight passport crop.',
    o.ratio==='square'?'Compose for a square social avatar crop, with face centered and fully inside a circular safe area.':'Compose for a 4:5 vertical portrait.',
    o.retouch==='light'?'Only lightly even temporary blemishes and lighting. Preserve skin texture, real facial anatomy, marks and age; no face slimming, added makeup or face swap.':'No cosmetic retouching: preserve original skin texture, blemishes and makeup.',
    'Keep the real hairstyle and hairline, gently tidy flyaways only. Preserve ears and facial features; never invent obscured anatomy. Use soft, natural studio lighting.'
  ].join(' ');
}
