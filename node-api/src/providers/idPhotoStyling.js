export const GROOMING_MODES = ['natural', 'neat', 'passport', 'custom'];
const presets = {
  natural: { flyaways: true, smoothVolume: false, clearForehead: false, tuckSides: false },
  neat: { flyaways: true, smoothVolume: true, clearForehead: true, tuckSides: true },
  passport: { flyaways: true, smoothVolume: true, clearForehead: true, tuckSides: true },
  custom: { flyaways: true, smoothVolume: true, clearForehead: false, tuckSides: false }
};

export function normalizeIdPhotoStyling({ groomingMode = 'natural', hairOptions, retouchEnabled = false, fullPackage = false, beautyOptions } = {}) {
  const invalid = () => { throw Object.assign(new Error('invalid ID photo grooming options'), { statusCode: 400 }); };
  if (!GROOMING_MODES.includes(groomingMode)) invalid();
  if (typeof retouchEnabled !== 'boolean' || typeof fullPackage !== 'boolean') invalid();
  const beautyDefaults = { skin: true, contour: false, vitality: true, makeup: false };
  if (beautyOptions !== undefined && (beautyOptions === null || typeof beautyOptions !== 'object' || Array.isArray(beautyOptions))) invalid();
  for (const [key, value] of Object.entries(beautyOptions ?? {})) {
    if (!Object.hasOwn(beautyDefaults, key) || typeof value !== 'boolean') invalid();
  }
  // Passport-style always wins over cosmetic options, including direct API calls.
  if (groomingMode === 'passport') { fullPackage = false; retouchEnabled = false; }
  else if (fullPackage) { groomingMode = 'neat'; retouchEnabled = true; }
  const effectiveBeauty = Object.fromEntries(Object.entries({ ...beautyDefaults, ...beautyOptions }).map(([key, value]) => [key, retouchEnabled && (fullPackage || value)]));
  if (hairOptions !== undefined && (hairOptions === null || typeof hairOptions !== 'object' || Array.isArray(hairOptions))) invalid();
  for (const [key, value] of Object.entries(hairOptions ?? {})) {
    if (!Object.hasOwn(presets.custom, key) || typeof value !== 'boolean') invalid();
  }
  return {
    groomingMode,
    retouchEnabled,
    fullPackage,
    beautyOptions: effectiveBeauty,
    hairOptions: { ...presets[groomingMode], ...(groomingMode === 'custom' ? hairOptions : {}) }
  };
}

export function groomingPrompt(styling) {
  const { groomingMode, hairOptions: hair } = normalizeIdPhotoStyling(styling);
  const rules = [
    'HAIR GROOMING: preserve the real hairline, hair color, hair length, natural hair texture and realistic density. Do not add hair, a wig, hair extensions or change the person\'s identity.',
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


export function beautyPrompt(styling) {
  const { retouchEnabled, beautyOptions: beauty } = normalizeIdPhotoStyling(styling);
  if (!retouchEnabled) return 'RETOUCH OFF: do not apply cosmetic retouching, skin smoothing, facial contour changes, complexion enhancement or makeup. Preserve skin texture, blemishes, natural facial proportions and original makeup. Only perform the requested pose, background, clothing and hair edits.';
  return [
    'RETOUCH ON: make a subtle, photorealistic professional portrait edit of the SAME recognizable person. Do not change age, ethnicity, eye size, nose shape or lip shape. No face swap, extreme slimming or plastic skin.',
    beauty.skin ? 'Gently soften temporary blemishes and uneven skin texture while keeping pores and permanent distinctive marks.' : 'Keep skin texture and blemishes unchanged; no smoothing.',
    beauty.contour ? 'Subtly refine the jawline and cheek contour with gentle shaping and studio contour lighting; keep the original facial structure and proportions recognizable. No drastic V-line or bone-structure change.' : 'Preserve the exact face outline, cheek volume and jaw width; no face slimming or reshaping.',
    beauty.vitality ? 'Add a rested, healthy appearance through balanced skin tones, subtle natural cheek and lip color and softened under-eye shadows. Preserve the actual skin tone.' : 'Keep the original complexion, under-eye shadows and natural cheek/lip color.',
    beauty.makeup ? 'Apply restrained camera-ready makeup: light natural base, softly groomed brows, subtle definition and a natural lip tint. No heavy lashes, dramatic eyeliner or glam makeup.' : 'Do not add or intensify makeup. Keep the original makeup level.'
  ].join(' ');
}
