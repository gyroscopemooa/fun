const countryToLocale = {
  KR: 'ko',
  JP: 'ja',
  US: 'en',
  GB: 'en',
  CA: 'en',
  AU: 'en',
  NZ: 'en',
  CN: 'zh', ES: 'es', DE: 'de', FR: 'fr', IT: 'it', NL: 'nl', RU: 'ru', IN: 'hi', TR: 'tr', PL: 'pl',
  TH: 'th', SE: 'sv', UA: 'uk', BR: 'pt', MX: 'es', ID: 'id', VN: 'vi', SA: 'ar', AE: 'ar', IL: 'he', IR: 'fa',
  BD: 'bn', MY: 'ms', PH: 'fil', PK: 'ur', LK: 'ta', GR: 'el', CZ: 'cs', DK: 'da', FI: 'fi', NO: 'no', RO: 'ro',
  HU: 'hu', ZA: 'af', KE: 'sw', TZ: 'sw', MM: 'my', KH: 'km', NP: 'ne', RS: 'sr', BG: 'bg', SK: 'sk', HR: 'hr'
  ,KZ: 'kk', UZ: 'uz', AZ: 'az', AM: 'hy', GE: 'ka', LT: 'lt', LV: 'lv', EE: 'et', SI: 'sl', BA: 'bs', MK: 'mk',
  AL: 'sq', IS: 'is', IE: 'en', BE: 'nl', CH: 'de', AT: 'de', PT: 'pt', CL: 'es', AR: 'es', CO: 'es', PE: 'es',
  NG: 'en', GH: 'en', ET: 'am', MA: 'ar', EG: 'ar', TN: 'ar', QA: 'ar', KW: 'ar', OM: 'ar'
};
const supportedLocales = new Set('ko en ja zh es de fr pt vi id ar bn bg ca cs da el et fa fi he hi hr hu is it kk km kn lo lt lv mk ml mn mr ms my ne nl no pa pl ro ru sk sl sr sv sw ta te th tl tr uk ur uz am az be bs cy eo gl gu hy ka la si so sq af zu fil jv su ceb ha ig yo eu mt ga lb mi ht haw sn st xh rw tk tg ky ps sd ku tt ug'.split(' '));

export async function onRequest({ request }) {
  const country = String(request.cf?.country || '').toUpperCase();
  const acceptLanguage = request.headers.get('accept-language') || '';
  const browserLocale = acceptLanguage
    .split(',')
    .map((entry) => entry.trim().split(';')[0].split('-')[0].toLowerCase())
    .find((value) => supportedLocales.has(value));

  return new Response(JSON.stringify({
    country: country || null,
    locale: browserLocale || countryToLocale[country] || null
  }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, max-age=300'
    }
  });
}
