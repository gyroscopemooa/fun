const countryToLocale = {
  KR: 'ko',
  JP: 'ja',
  US: 'en',
  GB: 'en',
  CA: 'en',
  AU: 'en',
  NZ: 'en'
};

export async function onRequest({ request }) {
  const country = String(request.cf?.country || '').toUpperCase();
  const acceptLanguage = request.headers.get('accept-language') || '';
  const browserLocale = acceptLanguage
    .split(',')
    .map((entry) => entry.trim().split(';')[0].split('-')[0].toLowerCase())
    .find((value) => ['ko', 'en', 'ja'].includes(value));

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
