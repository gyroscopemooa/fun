export const GROOMING_MODES = ['natural', 'neat', 'passport', 'custom'];
const presets = {
  natural: { flyaways: true, smoothVolume: false, clearForehead: false, tuckSides: false },
  neat: { flyaways: true, smoothVolume: true, clearForehead: true, tuckSides: true },
  passport: { flyaways: true, smoothVolume: true, clearForehead: true, tuckSides: true },
  custom: { flyaways: true, smoothVolume: true, clearForehead: false, tuckSides: false }
};

export function normalizeIdPhotoStyling({ groomingMode = 'natural', hairOptions } = {}) {
  const invalid = () => { throw Object.assign(new Error('invalid ID photo grooming options'), { statusCode: 400 }); };
  if (!GROOMING_MODES.includes(groomingMode)) invalid();
  if (hairOptions !== undefined && (hairOptions === null || typeof hairOptions !== 'object' || Array.isArray(hairOptions))) invalid();
  for (const [key, value] of Object.entries(hairOptions ?? {})) {
    if (!Object.hasOwn(presets.custom, key) || typeof value !== 'boolean') invalid();
  }
  return {
    groomingMode,
    hairOptions: { ...presets[groomingMode], ...(groomingMode === 'custom' ? hairOptions : {}) }
  };
}

export function groomingPrompt(styling) {
  const { groomingMode, hairOptions: hair } = normalizeIdPhotoStyling(styling);
  const rules = [
    'HAIR GROOMING: preserve the real hairline, hair color, hair length, natural hair texture and realistic density. Do not add hair, a wig, hair extensions or change the face.',
    groomingMode === 'natural'
      ? 'Natural mode: keep the original hairstyle, parting, bangs and volume. Only lightly tidy isolated stray hairs; do not restyle the hair.'
      : 'The user explicitly requests hair grooming. You may rearrange existing strands and parting as specified below. Preserve identity, but do NOT preserve messy bedhead styling when a tidying option is enabled.'
  ];
  if (groomingMode === 'neat' || groomingMode === 'passport') rules.push(
    'Restyle even very frizzy, tangled, windblown or just-woke-up bedhead into carefully combed, professionally groomed hair. Resolve messy clumps and uneven silhouette into orderly strands with a clean, natural contour. Make a visible grooming improvement, not merely remove a few hairs. Keep natural texture; avoid plastic helmet-like hair.',
    'Finish with balanced soft front lighting, clean white background, level head and shoulders and tidy clothing edges without changing facial features or skin texture.'
  );
  rules.push(
    hair.flyaways ? 'Remove loose flyaways and stray hairs crossing the face; neatly arrange those strands into the existing hairstyle.' : 'Leave isolated flyaways as they are; do not perform additional flyaway removal.',
    hair.smoothVolume ? 'Tame frizz, bedhead and excessive puffiness. Comb existing hair into a smooth, orderly silhouette while preserving its natural curl or wave pattern.' : 'Keep the original hair volume, curls and overall silhouette; do not flatten or straighten the hair.',
    hair.clearForehead ? 'Neatly sweep existing bangs aside so both eyes and eyebrows are unobstructed. Reveal the forehead only by moving hair, never by moving the hairline or altering the forehead.' : 'Keep the original bangs and forehead coverage. Do not sweep bangs away or expose more forehead.',
    hair.tuckSides ? 'Arrange or tuck existing side strands back naturally so the cheek and jaw contours are clear; do not invent or reshape ears.' : 'Keep side hair placement and ear coverage unchanged; do not tuck it behind the ears.'
  );
  if (groomingMode === 'passport') rules.push('Passport-style composition only: face directly forward with a neutral expression, mouth closed and both eyes open. Do not retouch skin, remove marks or change facial anatomy. No beauty filter. This styling does not certify compliance with any official submission rules.');
  return rules.join(' ');
}
