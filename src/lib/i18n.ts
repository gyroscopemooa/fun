import i18next from 'i18next';

export const localeCodes = ['ko', 'en', 'ja', 'zh', 'es', 'de', 'fr', 'pt', 'vi', 'id', 'it', 'nl', 'ru', 'ar', 'hi', 'tr', 'pl', 'th', 'sv', 'uk', 'ca', 'cs', 'da', 'fi', 'no', 'ro', 'el', 'he', 'hu', 'bn', 'ms', 'sw', 'fil', 'af', 'fa', 'ta', 'te', 'ur', 'mr'] as const;
export type Locale = typeof localeCodes[number];
// SEO route catalog. The first ten locales have reviewed UI copy; the wider
// catalog gives search engines stable language landing pages while content is
// progressively translated.
export const seoLocaleCodes = ['ko','en','ja','zh','es','de','fr','pt','vi','id','ar','bn','bg','ca','cs','da','el','et','fa','fi','he','hi','hr','hu','is','it','kk','km','kn','lo','lt','lv','mk','ml','mn','mr','ms','my','ne','nl','no','pa','pl','ro','ru','sk','sl','sr','sv','sw','ta','te','th','tl','tr','uk','ur','uz','am','az','be','bs','cy','eo','gl','gu','hy','ka','la','si','so','sq','af','zu','fil','jv','su','ceb','ha','ig','yo','eu','mt','ga','lb','mi','ht','haw','sn','st','xh','rw','tk','tg','ky','ps','sd','ku','tt','ug'] as const;

// Translation rollout order. A locale is added here only after its SEO pages
// and copy have been generated; this prevents language buttons from leading to
// untranslated or missing routes.
const reviewedLanguageNames: Record<string, [string, string]> = {
  ko:['Korean','한국어'], en:['English','English'], ja:['Japanese','日本語'], zh:['Chinese','简体中文'], es:['Spanish','Español'], de:['German','Deutsch'], fr:['French','Français'], pt:['Portuguese','Português'], vi:['Vietnamese','Tiếng Việt'], id:['Indonesian','Bahasa Indonesia'],
  it:['Italian','Italiano'], nl:['Dutch','Nederlands'], ru:['Russian','Русский'], ar:['Arabic','العربية'], hi:['Hindi','हिन्दी'], tr:['Turkish','Türkçe'], pl:['Polish','Polski'], th:['Thai','ไทย'], sv:['Swedish','Svenska'], uk:['Ukrainian','Українська'], ca:['Catalan','Català'], cs:['Czech','Čeština'], da:['Danish','Dansk'], fi:['Finnish','Suomi'], no:['Norwegian','Norsk'], ro:['Romanian','Română'], el:['Greek','Ελληνικά'], he:['Hebrew','עברית'], hu:['Hungarian','Magyar'], bn:['Bengali','বাংলা'], ms:['Malay','Bahasa Melayu'], sw:['Swahili','Kiswahili'], fil:['Filipino','Filipino'], af:['Afrikaans','Afrikaans'], fa:['Persian','فارسی'], ta:['Tamil','தமிழ்'], te:['Telugu','తెలుగు'], ur:['Urdu','اردو'], mr:['Marathi','मराठी'],
};
const languageDisplayNames = new Intl.DisplayNames(['en'], { type: 'language' });
export const rolloutLocales = seoLocaleCodes.map((code) => {
  const displayName = languageDisplayNames.of(code) ?? code.toUpperCase();
  return { code, name: reviewedLanguageNames[code]?.[0] ?? displayName, nativeName: reviewedLanguageNames[code]?.[1] ?? displayName };
});

const resources = {
  ko: {
    translation: {
      common: {
        home: '홈',
        soon: '준비 중',
      },
      header: {
        fortune: '운세',
        game: '게임',
        fishbreadMap: '붕어빵 지도',
        contact: '문의',
      },
      footer: {
        rights: 'All rights reserved.',
        about: '소개',
        privacy: '개인정보',
        terms: '약관',
        refund: '환불정책',
        contact: '문의',
        editorial: '운영원칙',
        disclaimer: '면책고지',
      },
      layout: {
        descriptionSuffix: '',
        freeBodyLabel: {
          todayFortune: '무료 오늘의 운세',
          nameMeaning: '무료 이름풀이',
          nameCompatibility: '무료 이름궁합',
          loveCompatibility: '무료 연애궁합',
        },
        softwareDescription: '테스트, 게임, 지도, 랜덤 도구를 제공하는 온라인 툴 플랫폼',
        faq: {
          q1: 'ManyTool은 무엇인가?',
          a1: 'ManyTool은 온라인 도구, 테스트, 게임, 지도 기능을 제공하는 웹 기반 플랫폼입니다.',
          q2: '온라인 도구란 무엇인가?',
          a2: '브라우저에서 설치 없이 바로 사용하는 웹 기반 도구입니다.',
          q3: 'MBTI 테스트는 무엇인가?',
          a3: '질문 응답을 기반으로 성격 유형을 분류하는 테스트입니다.',
          q4: '궁합 테스트는 어떻게 작동하는가?',
          a4: '입력값 기반 규칙으로 궁합 점수와 결과를 계산해 보여줍니다.',
        },
        sidebar: {
          title: 'ManyTool',
          subtitle: '빠른 바로가기',
          donate: '기부하기',
          donateHint: '사이트 운영을 돕고 싶다면 후원해주세요.',
          donateLoading: '결제 이동 중...',
          donateUnavailable: '기부 상품 준비 중',
          open: '사이드바 펼치기',
          close: '사이드바 접기',
          aiImage: 'AI 이미지 생성기',
          aiCalorie: 'AI 칼로리 계산기',
          aiIdPhoto: 'AI 증명사진',
          productDetail: '상세페이지 생성기',
        },
      },
      recommend: {
        title: '실시간 인기 콘텐츠',
        top: '현재 인기 1위',
        rankPrefix: '1위:',
        items: {
          animalTest: '동물상 테스트',
          personalColor: '퍼스널컬러 테스트',
          mbti: 'MBTI 테스트',
          loveCompatibility: '연애 궁합 테스트',
          nameMeaning: '이름풀이',
          nameCompatibility: '이름궁합',
          reactionTest: '반응속도 테스트',
          fpsAim: 'FPS 에임 조절기',
          aiCalorie: 'AI 칼로리 계산기',
          ladderGame: '사다리타기',
          todayFortune: '오늘의 운세',
          fortuneCookie: '올해 포츈쿠키',
          hiddenCafe: '숨은 카페 지도',
          soloDining: '혼밥 가능 식당 공유',
          pinball: '핀볼 게임',
          randomFood: '랜덤 음식 추천',
          scoreboard: '스트리머 점수판',
          faceShape: '얼굴형테스트',
          nickname: '닉네임생성기',
          chatRandomPicker: '채팅 랜덤 뽑기',
          memeGenerator: '밈 생성기',
          randomPicker: '랜덤뽑기',
          roulette: '룰렛',
          teamSplit: '팀나누기',
          textCounter: '글자수세기',
          dailyEnglishWord: '오늘의 영단어',
          dailySentence: '하루 영어 한문장',
          streamerBattle: '스트리머 대결 툴',
          dailySpanish: '오늘의 스페인어',
          dailyJapanese: '오늘의 일본어',
          koreanStudy: '오늘의 한국어공부',
        },
      },
      home: {
        tabs: {
          all: '전체',
          games: '게임',
          tools: '도구',
          art: '아트',
          etc: '기타',
        },
        searchPlaceholder: '원하는 기능을 검색해보세요',
        heroTitle: '재미 도구 모음',
        heroDesc: '카드에서 바로 시작하세요.',
        noResult: '검색 결과가 없습니다.',
        guideTitle: 'ManyTool 사용 가이드',
        guideP1: 'ManyTool은 짧은 시간에 바로 사용할 수 있는 기능형 페이지를 중심으로 구성됩니다.',
        guideP2: '테스트, 게임, 지도, 랜덤 도구를 카드에서 바로 열고, 하단 추천 링크를 통해 연관 기능으로 이동할 수 있습니다.',
        guideDonate: 'ManyTool 후원하기',
        guideDonateHint: '사이트가 유용했다면 작은 후원으로 운영을 도와주세요.',
        faqTitle: '자주 묻는 질문',
        faqQ1: 'Q. ManyTool은 무료인가요?',
        faqA1: 'A. 현재 제공되는 기능은 무료로 이용할 수 있습니다.',
        faqQ2: 'Q. 지도 정보가 다를 수도 있나요?',
        faqA2: 'A. 제보 기반 정보가 포함될 수 있어, 방문 전 최신 운영 여부 확인을 권장합니다.',
        faqQ3: 'Q. 정책 페이지는 어디에서 확인하나요?',
        faqA3: 'A. 페이지 하단 푸터(개인정보/약관/운영원칙/면책고지)에서 확인할 수 있습니다.',
        donateUnavailable: '기부 상품을 아직 준비 중입니다.',
        donateLoading: '결제 이동 중...',
        donateFailed: '기부 결제를 시작하지 못했습니다.',
        prevCard: '이전 카드',
        nextCard: '다음 카드',
      },
    },
  },
  en: {
    translation: {
      common: {
        home: 'Home',
        soon: 'Soon',
      },
      header: {
        fortune: 'Fortune',
        game: 'Game',
        fishbreadMap: 'Fishbread Map',
        contact: 'Contact',
      },
      footer: {
        rights: 'All rights reserved.',
        about: 'About',
        privacy: 'Privacy',
        terms: 'Terms',
        refund: 'Refunds',
        contact: 'Contact',
        editorial: 'Editorial',
        disclaimer: 'Disclaimer',
      },
      layout: {
        descriptionSuffix: ' | English version of this page.',
        softwareDescription: 'An online tool platform with tests, games, maps, and quick utilities.',
        faq: {
          q1: 'What is ManyTool?',
          a1: 'ManyTool is a web-based platform with online tools, tests, games, and map features.',
          q2: 'What is an online tool?',
          a2: 'It is a browser-based tool you can use instantly without installing anything.',
          q3: 'What is an MBTI test?',
          a3: 'It is a personality-type test based on your answers to a set of questions.',
          q4: 'How does a compatibility test work?',
          a4: 'It calculates a score and summary using rules based on your input values.',
        },
        sidebar: {
          title: 'ManyTool',
          subtitle: 'Quick Links',
          donate: 'Donate',
          donateHint: 'Support the site if you want to help keep it running.',
          donateLoading: 'Redirecting to checkout...',
          donateUnavailable: 'Donation product not ready',
          open: 'Open sidebar',
          close: 'Close sidebar',
          aiImage: 'AI Image Generator',
          aiCalorie: 'AI Calorie Calculator',
          aiIdPhoto: 'AI ID Photo',
          productDetail: 'AI Product Detail Studio',
        },
      },
      recommend: {
        title: 'Trending Now',
        top: 'Current #1',
        rankPrefix: '#1:',
        items: {
          animalTest: 'Animal Face Test',
          personalColor: 'Personal Color Test',
          mbti: 'MBTI Test',
          loveCompatibility: 'Love Compatibility',
          nameMeaning: 'Name Meaning',
          nameCompatibility: 'Name Match',
          reactionTest: 'Reaction Test',
          fpsAim: 'FPS Aim Sensitivity',
          aiCalorie: 'AI Calorie Calculator',
          ladderGame: 'Ladder Game',
          todayFortune: 'Today Fortune',
          fortuneCookie: 'Year Fortune Cookie',
          hiddenCafe: 'Hidden Cafe Map',
          soloDining: 'Solo Dining Map',
          pinball: 'Pinball Game',
          randomFood: 'Random Food',
          scoreboard: 'Streamer Scoreboard',
          faceShape: 'Face Shape Test',
          nickname: 'Nickname Generator',
          chatRandomPicker: 'Chat Random Picker',
          memeGenerator: 'Meme Generator',
          randomPicker: 'Random Picker',
          roulette: 'Roulette',
          teamSplit: 'Team Split',
          textCounter: 'Text Counter',
          dailyEnglishWord: 'Daily English Word',
          dailySentence: 'Daily English Sentence',
          streamerBattle: 'Streamer Battle Tool',
          dailySpanish: 'Daily Spanish',
          dailyJapanese: 'Daily Japanese',
          koreanStudy: 'Daily Korean Study',
        },
      },
      home: {
        tabs: {
          all: 'All',
          games: 'Games',
          tools: 'Tools',
          art: 'Art',
          etc: 'Etc',
        },
        searchPlaceholder: 'Search tools',
        heroTitle: 'Playful Tools',
        heroDesc: 'Start directly from cards.',
        noResult: 'No results found.',
        guideTitle: 'ManyTool Guide',
        guideP1: 'ManyTool is built for fast, practical pages you can use immediately.',
        guideP2: 'Open tests, games, maps, and random tools directly from cards.',
        guideDonate: 'Support ManyTool',
        guideDonateHint: 'If this site is useful, you can support it with a small donation.',
        faqTitle: 'FAQ',
        faqQ1: 'Q. Is ManyTool free?',
        faqA1: 'A. Yes, current features are free.',
        faqQ2: 'Q. Can map information be outdated?',
        faqA2: 'A. Some spots are user-submitted, so please verify before visiting.',
        faqQ3: 'Q. Where are policy pages?',
        faqA3: 'A. Check the footer links for Privacy, Terms, Editorial, and Disclaimer.',
        donateUnavailable: 'Donation product not ready.',
        donateLoading: 'Redirecting to checkout...',
        donateFailed: 'Could not start donation checkout.',
        prevCard: 'Previous card',
        nextCard: 'Next card',
      },
    },
  },
  ja: {
    translation: {
      common: {
        home: 'ホーム',
        soon: '準備中',
      },
      header: {
        fortune: '運勢',
        game: 'ゲーム',
        fishbreadMap: 'たい焼きマップ',
        contact: 'お問い合わせ',
      },
      footer: {
        rights: 'All rights reserved.',
        about: '概要',
        privacy: 'プライバシー',
        terms: '利用規約',
        refund: '返金方針',
        contact: 'お問い合わせ',
        editorial: '運営方針',
        disclaimer: '免責事項',
      },
      layout: {
        descriptionSuffix: ' | 日本語ページです。',
        softwareDescription: 'テスト、ゲーム、マップ、ランダムツールを提供するオンラインツールプラットフォームです。',
        faq: {
          q1: 'ManyToolとは何ですか？',
          a1: 'ManyToolはオンラインツール、テスト、ゲーム、マップ機能を提供するWebベースのプラットフォームです。',
          q2: 'オンラインツールとは何ですか？',
          a2: 'インストール不要でブラウザからすぐ使えるWebベースのツールです。',
          q3: 'MBTIテストとは何ですか？',
          a3: '質問への回答をもとに性格タイプを分類するテストです。',
          q4: '相性テストはどう動作しますか？',
          a4: '入力値ベースのルールから相性スコアと結果を計算して表示します。',
        },
        sidebar: {
          title: 'ManyTool',
          subtitle: 'クイックリンク',
          donate: '寄付する',
          donateHint: 'サイト運営を支援したい場合はご利用ください。',
          donateLoading: '決済ページへ移動中...',
          donateUnavailable: '寄付商品を準備中です',
          open: 'サイドバーを開く',
          close: 'サイドバーを閉じる',
          aiImage: 'AI画像生成',
          aiCalorie: 'AIカロリー計算機',
          aiIdPhoto: 'AI証明写真',
          productDetail: '商品詳細ページ生成',
        },
      },
      recommend: {
        title: '人気コンテンツ',
        top: '現在の1位',
        rankPrefix: '1位:',
        items: {
          animalTest: '動物顔テスト',
          personalColor: 'パーソナルカラーテスト',
          mbti: 'MBTIテスト',
          loveCompatibility: '恋愛相性テスト',
          nameMeaning: '名前診断',
          nameCompatibility: '名前相性',
          reactionTest: '反応速度テスト',
          fpsAim: 'FPSエイム感度調整',
          aiCalorie: 'AIカロリー計算機',
          ladderGame: 'あみだくじ',
          todayFortune: '今日の運勢',
          fortuneCookie: '今年のフォーチュンクッキー',
          hiddenCafe: '隠れカフェマップ',
          soloDining: 'ひとりご飯マップ',
          pinball: 'ピンボールゲーム',
          randomFood: 'ランダム料理おすすめ',
          scoreboard: 'ストリーマースコアボード',
          faceShape: '顔型テスト',
          nickname: 'ニックネーム生成',
          chatRandomPicker: 'チャット抽選',
          memeGenerator: 'ミーム生成',
          randomPicker: 'ランダム抽選',
          roulette: 'ルーレット',
          teamSplit: 'チーム分け',
          textCounter: '文字数カウンター',
          dailyEnglishWord: '今日の英単語',
          dailySentence: '毎日の英語一文',
          streamerBattle: 'ストリーマー対決ツール',
          dailySpanish: '今日のスペイン語',
          dailyJapanese: '今日の日本語',
          koreanStudy: '今日の韓国語学習',
        },
      },
      home: {
        tabs: {
          all: '全体',
          games: 'ゲーム',
          tools: 'ツール',
          art: 'アート',
          etc: 'その他',
        },
        searchPlaceholder: 'ツールを検索',
        heroTitle: '楽しいツール集',
        heroDesc: 'カードからすぐ開始できます。',
        noResult: '検索結果がありません。',
        guideTitle: 'ManyTool ガイド',
        guideP1: 'ManyToolはすぐ使える実用ページを中心に構成されています。',
        guideP2: 'テスト、ゲーム、マップ、ランダムツールをカードから直接開けます。',
        guideDonate: 'ManyToolを支援する',
        guideDonateHint: '便利だと感じたら、小さな寄付で運営を支援できます。',
        faqTitle: 'よくある質問',
        faqQ1: 'Q. ManyToolは無料ですか？',
        faqA1: 'A. 現在の機能は無料です。',
        faqQ2: 'Q. 地図情報が異なる場合はありますか？',
        faqA2: 'A. ユーザー投稿情報を含むため、訪問前の確認をおすすめします。',
        faqQ3: 'Q. ポリシーページはどこですか？',
        faqA3: 'A. フッターのプライバシー/利用規約/運営方針/免責事項をご確認ください。',
        donateUnavailable: '寄付商品を準備中です。',
        donateLoading: '決済ページへ移動中...',
        donateFailed: '寄付決済を開始できませんでした。',
        prevCard: '前のカード',
        nextCard: '次のカード',
      },
    },
  },
} as const;

const additionalTranslations = {
  bn: { translation: { common: { home: 'হোম', soon: 'শীঘ্রই আসছে' }, header: { fortune: 'ভাগ্য', game: 'গেম', contact: 'যোগাযোগ' }, home: { searchPlaceholder: 'টুল খুঁজুন', heroTitle: 'মজার টুল', noResult: 'কোনো ফলাফল নেই।' } } },
  ms: { translation: { common: { home: 'Laman utama', soon: 'Akan datang' }, header: { fortune: 'Nasib', game: 'Permainan', contact: 'Hubungi' }, home: { searchPlaceholder: 'Cari alat', heroTitle: 'Alat praktikal', noResult: 'Tiada hasil.' } } },
  sw: { translation: { common: { home: 'Mwanzo', soon: 'Inakuja hivi karibuni' }, header: { fortune: 'Bahati', game: 'Michezo', contact: 'Wasiliana' }, home: { searchPlaceholder: 'Tafuta zana', heroTitle: 'Zana muhimu', noResult: 'Hakuna matokeo.' } } },
  fil: { translation: { common: { home: 'Tahanan', soon: 'Malapit na' }, header: { fortune: 'Suwerte', game: 'Laro', contact: 'Makipag-ugnayan' }, home: { searchPlaceholder: 'Maghanap ng tools', heroTitle: 'Mga kapaki-pakinabang na tool', noResult: 'Walang resulta.' } } },
  af: { translation: { common: { home: 'Tuis', soon: 'Binnekort' }, header: { fortune: 'Fortuin', game: 'Speletjies', contact: 'Kontak' }, home: { searchPlaceholder: 'Soek gereedskap', heroTitle: 'Nuttige gereedskap', noResult: 'Geen resultate nie.' } } },
  fa: { translation: { common: { home: 'خانه', soon: 'به‌زودی' }, header: { fortune: 'فال', game: 'بازی', contact: 'تماس' }, home: { searchPlaceholder: 'جستجوی ابزارها', heroTitle: 'ابزارهای کاربردی', noResult: 'نتیجه‌ای پیدا نشد.' } } },
  ta: { translation: { common: { home: 'முகப்பு', soon: 'விரைவில்' }, header: { fortune: 'அதிர்ஷ்டம்', game: 'விளையாட்டுகள்', contact: 'தொடர்பு' }, home: { searchPlaceholder: 'கருவிகளைத் தேடு', heroTitle: 'பயனுள்ள கருவிகள்', noResult: 'முடிவுகள் இல்லை.' } } },
  te: { translation: { common: { home: 'హోమ్', soon: 'త్వరలో' }, header: { fortune: 'అదృష్టం', game: 'గేమ్స్', contact: 'సంప్రదించండి' }, home: { searchPlaceholder: 'టూల్స్ వెతకండి', heroTitle: 'ఉపయోగకరమైన టూల్స్', noResult: 'ఫలితాలు లేవు.' } } },
  ur: { translation: { common: { home: 'ہوم', soon: 'جلد آ رہا ہے' }, header: { fortune: 'قسمت', game: 'گیمز', contact: 'رابطہ' }, home: { searchPlaceholder: 'ٹولز تلاش کریں', heroTitle: 'مفید ٹولز', noResult: 'کوئی نتیجہ نہیں۔' } } },
  mr: { translation: { common: { home: 'मुख्यपृष्ठ', soon: 'लवकरच' }, header: { fortune: 'नशीब', game: 'खेळ', contact: 'संपर्क' }, home: { searchPlaceholder: 'टूल्स शोधा', heroTitle: 'उपयुक्त टूल्स', noResult: 'परिणाम सापडले नाहीत.' } } },
} as const;

const extendedTranslations = {
  bg: { translation: { common: { home: 'Начало', soon: 'Очаквайте скоро' }, header: { fortune: 'Късмет', game: 'Игри', contact: 'Контакти' }, home: { searchPlaceholder: 'Търсене на инструменти', heroTitle: 'Полезни инструменти', noResult: 'Няма резултати.' } } },
  et: { translation: { common: { home: 'Avaleht', soon: 'Varsti' }, header: { fortune: 'Õnn', game: 'Mängud', contact: 'Kontakt' }, home: { searchPlaceholder: 'Otsi tööriistu', heroTitle: 'Kasulikud tööriistad', noResult: 'Tulemusi ei leitud.' } } },
  hr: { translation: { common: { home: 'Početna', soon: 'Uskoro' }, header: { fortune: 'Sreća', game: 'Igre', contact: 'Kontakt' }, home: { searchPlaceholder: 'Pretraži alate', heroTitle: 'Korisni alati', noResult: 'Nema rezultata.' } } },
  is: { translation: { common: { home: 'Heim', soon: 'Væntanlegt' }, header: { fortune: 'Lukka', game: 'Leikir', contact: 'Hafa samband' }, home: { searchPlaceholder: 'Leita að verkfærum', heroTitle: 'Gagnleg verkfæri', noResult: 'Engar niðurstöður.' } } },
  kk: { translation: { common: { home: 'Басты бет', soon: 'Жақында' }, header: { fortune: 'Болжам', game: 'Ойындар', contact: 'Байланыс' }, home: { searchPlaceholder: 'Құралдарды іздеу', heroTitle: 'Пайдалы құралдар', noResult: 'Нәтиже табылмады.' } } },
  km: { translation: { common: { home: 'ទំព័រដើម', soon: 'នាពេលឆាប់ៗនេះ' }, header: { fortune: 'សំណាង', game: 'ហ្គេម', contact: 'ទំនាក់ទំនង' }, home: { searchPlaceholder: 'ស្វែងរកឧបករណ៍', heroTitle: 'ឧបករណ៍មានប្រយោជន៍', noResult: 'រកមិនឃើញលទ្ធផល។' } } },
  ne: { translation: { common: { home: 'गृहपृष्ठ', soon: 'चाँडै आउँदैछ' }, header: { fortune: 'भाग्य', game: 'खेल', contact: 'सम्पर्क' }, home: { searchPlaceholder: 'उपकरण खोज्नुहोस्', heroTitle: 'उपयोगी उपकरणहरू', noResult: 'कुनै नतिजा छैन।' } } },
  sk: { translation: { common: { home: 'Domov', soon: 'Už čoskoro' }, header: { fortune: 'Veštenie', game: 'Hry', contact: 'Kontakt' }, home: { searchPlaceholder: 'Hľadať nástroje', heroTitle: 'Užitočné nástroje', noResult: 'Nenašli sa žiadne výsledky.' } } },
  sl: { translation: { common: { home: 'Domov', soon: 'Kmalu' }, header: { fortune: 'Sreča', game: 'Igre', contact: 'Stik' }, home: { searchPlaceholder: 'Poišči orodja', heroTitle: 'Uporabna orodja', noResult: 'Ni rezultatov.' } } },
  sr: { translation: { common: { home: 'Почетна', soon: 'Ускоро' }, header: { fortune: 'Срећа', game: 'Игре', contact: 'Контакт' }, home: { searchPlaceholder: 'Претражи алате', heroTitle: 'Корисни алати', noResult: 'Нема резултата.' } } },
} as const;

const regionalTranslations = {
  ka: { translation: { common: { home: 'მთავარი', soon: 'მალე' }, header: { fortune: 'იღბალი', game: 'თამაშები', contact: 'კონტაქტი' }, home: { searchPlaceholder: 'ინსტრუმენტების ძიება', heroTitle: 'სასარგებლო ინსტრუმენტები', noResult: 'შედეგები ვერ მოიძებნა.' } } },
  hy: { translation: { common: { home: 'Գլխավոր', soon: 'Շուտով' }, header: { fortune: 'Բախտ', game: 'Խաղեր', contact: 'Կապ' }, home: { searchPlaceholder: 'Որոնել գործիքներ', heroTitle: 'Օգտակար գործիքներ', noResult: 'Արդյունք չկա։' } } },
  lt: { translation: { common: { home: 'Pagrindinis', soon: 'Netrukus' }, header: { fortune: 'Laimė', game: 'Žaidimai', contact: 'Kontaktai' }, home: { searchPlaceholder: 'Ieškoti įrankių', heroTitle: 'Naudingi įrankiai', noResult: 'Rezultatų nėra.' } } },
  lv: { translation: { common: { home: 'Sākums', soon: 'Drīzumā' }, header: { fortune: 'Veiksme', game: 'Spēles', contact: 'Kontakti' }, home: { searchPlaceholder: 'Meklēt rīkus', heroTitle: 'Noderīgi rīki', noResult: 'Rezultātu nav.' } } },
  uz: { translation: { common: { home: 'Bosh sahifa', soon: 'Tez orada' }, header: { fortune: 'Fol', game: 'O‘yinlar', contact: 'Aloqa' }, home: { searchPlaceholder: 'Vositalarni qidirish', heroTitle: 'Foydali vositalar', noResult: 'Natija topilmadi.' } } },
  az: { translation: { common: { home: 'Ana səhifə', soon: 'Tezliklə' }, header: { fortune: 'Bəxt', game: 'Oyunlar', contact: 'Əlaqə' }, home: { searchPlaceholder: 'Alətləri axtar', heroTitle: 'Faydalı alətlər', noResult: 'Nəticə tapılmadı.' } } },
  be: { translation: { common: { home: 'Галоўная', soon: 'Хутка' }, header: { fortune: 'Удача', game: 'Гульні', contact: 'Кантакты' }, home: { searchPlaceholder: 'Пошук інструментаў', heroTitle: 'Карысныя інструменты', noResult: 'Вынікаў няма.' } } },
  bs: { translation: { common: { home: 'Početna', soon: 'Uskoro' }, header: { fortune: 'Sreća', game: 'Igre', contact: 'Kontakt' }, home: { searchPlaceholder: 'Pretraži alate', heroTitle: 'Korisni alati', noResult: 'Nema rezultata.' } } },
  cy: { translation: { common: { home: 'Cartref', soon: 'Cyn bo hir' }, header: { fortune: 'Ffortiwn', game: 'Gemau', contact: 'Cysylltu' }, home: { searchPlaceholder: 'Chwilio offer', heroTitle: 'Offer defnyddiol', noResult: 'Dim canlyniadau.' } } },
  gl: { translation: { common: { home: 'Inicio', soon: 'En breve' }, header: { fortune: 'Fortuna', game: 'Xogos', contact: 'Contacto' }, home: { searchPlaceholder: 'Buscar ferramentas', heroTitle: 'Ferramentas útiles', noResult: 'Non hai resultados.' } } },
} as const;

const globalTranslations = {
  yo: { translation: { common: { home: 'Ile', soon: 'Laipẹ' }, header: { fortune: 'Orire', game: 'Ere', contact: 'Kan si' }, home: { searchPlaceholder: 'Wa awọn irinṣẹ', heroTitle: 'Awọn irinṣẹ to wulo', noResult: 'Ko si abajade.' } } },
  ha: { translation: { common: { home: 'Gida', soon: 'Nan zuwa' }, header: { fortune: "Sa'a", game: 'Wasanni', contact: 'Tuntuɓa' }, home: { searchPlaceholder: 'Nemo kayan aiki', heroTitle: 'Kayan aiki masu amfani', noResult: 'Ba a sami sakamako ba.' } } },
  ig: { translation: { common: { home: 'Ụlọ', soon: 'Na-abịa n’oge na-adịghị anya' }, header: { fortune: 'Ọchichọ', game: 'Egwuregwu', contact: 'Kpọtụrụ' }, home: { searchPlaceholder: 'Chọọ ngwaọrụ', heroTitle: 'Ngwaọrụ bara uru', noResult: 'Enweghị nsonaazụ.' } } },
  zu: { translation: { common: { home: 'Ekhaya', soon: 'Kuyeza maduze' }, header: { fortune: 'Inhlanhla', game: 'Imidlalo', contact: 'Xhumana' }, home: { searchPlaceholder: 'Sesha amathuluzi', heroTitle: 'Amathuluzi awusizo', noResult: 'Ayikho imiphumela.' } } },
  xh: { translation: { common: { home: 'Ekhaya', soon: 'Iyeza kungekudala' }, header: { fortune: 'Ithamsanqa', game: 'Imidlalo', contact: 'Qhagamshelana' }, home: { searchPlaceholder: 'Khangela izixhobo', heroTitle: 'Izixhobo eziluncedo', noResult: 'Akukho ziphumo.' } } },
  mi: { translation: { common: { home: 'Kāinga', soon: 'Ākuanei' }, header: { fortune: 'Waimarie', game: 'Ngā kēmu', contact: 'Whakapā' }, home: { searchPlaceholder: 'Rapua ngā taputapu', heroTitle: 'Ngā taputapu whaihua', noResult: 'Kāore he hua.' } } },
  ht: { translation: { common: { home: 'Akèy', soon: 'Byento' }, header: { fortune: 'Chans', game: 'Jwèt', contact: 'Kontakte' }, home: { searchPlaceholder: 'Chèche zouti', heroTitle: 'Zouti itil', noResult: 'Pa gen rezilta.' } } },
  si: { translation: { common: { home: 'මුල් පිටුව', soon: 'ළඟදීම' }, header: { fortune: 'වාසනාව', game: 'ක්‍රීඩා', contact: 'සම්බන්ධ වන්න' }, home: { searchPlaceholder: 'මෙවලම් සොයන්න', heroTitle: 'ප්‍රයෝජනවත් මෙවලම්', noResult: 'ප්‍රතිඵල නැත.' } } },
  pa: { translation: { common: { home: 'ਮੁੱਖ ਪੰਨਾ', soon: 'ਜਲਦੀ ਆ ਰਿਹਾ ਹੈ' }, header: { fortune: 'ਕਿਸਮਤ', game: 'ਖੇਡਾਂ', contact: 'ਸੰਪਰਕ' }, home: { searchPlaceholder: 'ਟੂਲ ਲੱਭੋ', heroTitle: 'ਲਾਭਦਾਇਕ ਟੂਲ', noResult: 'ਕੋਈ ਨਤੀਜਾ ਨਹੀਂ।' } } },
  gu: { translation: { common: { home: 'હોમ', soon: 'ટૂંક સમયમાં' }, header: { fortune: 'નસીબ', game: 'રમતો', contact: 'સંપર્ક' }, home: { searchPlaceholder: 'ટૂલ્સ શોધો', heroTitle: 'ઉપયોગી ટૂલ્સ', noResult: 'કોઈ પરિણામ નથી.' } } },
} as const;

const finalRegionalTranslations = {
  mn: { translation: { common: { home: 'Нүүр', soon: 'Удахгүй' }, header: { fortune: 'Аз', game: 'Тоглоом', contact: 'Холбоо барих' }, home: { searchPlaceholder: 'Хэрэгсэл хайх', heroTitle: 'Хэрэгтэй хэрэгслүүд', noResult: 'Үр дүн олдсонгүй.' } } },
  lo: { translation: { common: { home: 'ໜ້າຫຼັກ', soon: 'ໃນໄວໆນີ້' }, header: { fortune: 'ໂຊກ', game: 'ເກມ', contact: 'ຕິດຕໍ່' }, home: { searchPlaceholder: 'ຄົ້ນຫາເຄື່ອງມື', heroTitle: 'ເຄື່ອງມືທີ່ເປັນປະໂຫຍດ', noResult: 'ບໍ່ພົບຜົນລັບ.' } } },
  my: { translation: { common: { home: 'ပင်မ', soon: 'မကြာမီ' }, header: { fortune: 'ကံကြမ္မာ', game: 'ဂိမ်းများ', contact: 'ဆက်သွယ်ရန်' }, home: { searchPlaceholder: 'ကိရိယာများရှာရန်', heroTitle: 'အသုံးဝင်သောကိရိယာများ', noResult: 'ရလဒ်မရှိပါ။' } } },
  tk: { translation: { common: { home: 'Baş sahypa', soon: 'Ýakynda' }, header: { fortune: 'Bagty', game: 'Oýunlar', contact: 'Habarlaşmak' }, home: { searchPlaceholder: 'Gurallary gözle', heroTitle: 'Peýdaly gurallar', noResult: 'Netije tapylmady.' } } },
  tg: { translation: { common: { home: 'Асосӣ', soon: 'Ба зудӣ' }, header: { fortune: 'Бахт', game: 'Бозиҳо', contact: 'Тамос' }, home: { searchPlaceholder: 'Ҷустуҷӯи абзорҳо', heroTitle: 'Абзорҳои муфид', noResult: 'Натиҷа ёфт нашуд.' } } },
  ky: { translation: { common: { home: 'Башкы бет', soon: 'Жакында' }, header: { fortune: 'Бакыт', game: 'Оюндар', contact: 'Байланыш' }, home: { searchPlaceholder: 'Куралдарды издөө', heroTitle: 'Пайдалуу куралдар', noResult: 'Жыйынтык табылган жок.' } } },
  ps: { translation: { common: { home: 'کور', soon: 'ژر راځي' }, header: { fortune: 'بخت', game: 'لوبې', contact: 'اړیکه' }, home: { searchPlaceholder: 'وسایل ولټوئ', heroTitle: 'ګټور وسایل', noResult: 'پایلې ونه موندل شوې.' } } },
  sd: { translation: { common: { home: 'گهر', soon: 'جلد اچي رهيو آهي' }, header: { fortune: 'قسمت', game: 'رانديون', contact: 'رابطو' }, home: { searchPlaceholder: 'اوزار ڳوليو', heroTitle: 'مفيد اوزار', noResult: 'ڪا به نتيجا نه مليا.' } } },
  ku: { translation: { common: { home: 'سەرەکی', soon: 'بەم زووانە' }, header: { fortune: 'بەخت', game: 'یارییەکان', contact: 'پەیوەندی' }, home: { searchPlaceholder: 'گەڕان بەدوای ئامرازەکان', heroTitle: 'ئامرازە بەسوودەکان', noResult: 'هیچ ئەنجامێک نەدۆزرایەوە.' } } },
  tt: { translation: { common: { home: 'Баш бит', soon: 'Тиздән' }, header: { fortune: 'Бәхет', game: 'Уеннар', contact: 'Элемтә' }, home: { searchPlaceholder: 'Кораллар эзләү', heroTitle: 'Файдалы кораллар', noResult: 'Нәтиҗә табылмады.' } } },
} as const;

const lastTranslations = {
  am: { translation: { common: { home: 'መነሻ', soon: 'በቅርቡ' }, header: { fortune: 'ዕድል', game: 'ጨዋታዎች', contact: 'ያግኙን' }, home: { searchPlaceholder: 'መሳሪያዎችን ይፈልጉ', heroTitle: 'ጠቃሚ መሳሪያዎች', noResult: 'ውጤት አልተገኘም።' } } },
  ml: { translation: { common: { home: 'ഹോം', soon: 'ഉടൻ വരുന്നു' }, header: { fortune: 'ഭാഗ്യം', game: 'ഗെയിമുകൾ', contact: 'ബന്ധപ്പെടുക' }, home: { searchPlaceholder: 'ടൂളുകൾ തിരയുക', heroTitle: 'ഉപയോഗപ്രദമായ ടൂളുകൾ', noResult: 'ഫലങ്ങളില്ല.' } } },
  kn: { translation: { common: { home: 'ಮುಖಪುಟ', soon: 'ಶೀಘ್ರದಲ್ಲೇ' }, header: { fortune: 'ಅದೃಷ್ಟ', game: 'ಆಟಗಳು', contact: 'ಸಂಪರ್ಕ' }, home: { searchPlaceholder: 'ಪರಿಕರಗಳನ್ನು ಹುಡುಕಿ', heroTitle: 'ಉಪಯುಕ್ತ ಪರಿಕರಗಳು', noResult: 'ಫಲಿತಾಂಶಗಳಿಲ್ಲ.' } } },
  la: { translation: { common: { home: 'Domus', soon: 'Mox' }, header: { fortune: 'Fortuna', game: 'Ludi', contact: 'Contactus' }, home: { searchPlaceholder: 'Quaere instrumenta', heroTitle: 'Instrumenta utilia', noResult: 'Nulli eventus.' } } },
  so: { translation: { common: { home: 'Hoyga', soon: 'Dhawaan' }, header: { fortune: 'Nasiib', game: 'Ciyaaro', contact: 'La xiriir' }, home: { searchPlaceholder: 'Raadi qalab', heroTitle: 'Qalab waxtar leh', noResult: 'Natiijo lama helin.' } } },
  sn: { translation: { common: { home: 'Kumba', soon: 'Munguva pfupi' }, header: { fortune: 'Rombo', game: 'Mitambo', contact: 'Bata nesu' }, home: { searchPlaceholder: 'Tsvaga zvishandiso', heroTitle: 'Zvishandiso zvinobatsira', noResult: 'Hapana zvawanikwa.' } } },
  st: { translation: { common: { home: 'Lehae', soon: 'Haufinyane' }, header: { fortune: 'Lehlohonolo', game: 'Lipapali', contact: 'Iteanye' }, home: { searchPlaceholder: 'Batla lisebelisoa', heroTitle: 'Lisebelisoa tse molemo', noResult: 'Ha ho liphetho.' } } },
  jv: { translation: { common: { home: 'Ngarep', soon: 'Sakcepete' }, header: { fortune: 'Bejo', game: 'Game', contact: 'Kontak' }, home: { searchPlaceholder: 'Goleki piranti', heroTitle: 'Piranti migunani', noResult: 'Ora ana asil.' } } },
  su: { translation: { common: { home: 'Beranda', soon: 'Enggal' }, header: { fortune: 'Kabeneran', game: 'Kaulinan', contact: 'Kontak' }, home: { searchPlaceholder: 'Pilarian alat', heroTitle: 'Alat anu mangpaat', noResult: 'Teu aya hasil.' } } },
  ceb: { translation: { common: { home: 'Home', soon: 'Sa dili madugay' }, header: { fortune: 'Swerte', game: 'Mga dula', contact: 'Kontak' }, home: { searchPlaceholder: 'Pangitaa ang mga himan', heroTitle: 'Mapuslanong mga himan', noResult: 'Walay resulta.' } } },
} as const;

const edgeTranslations = {
  ca: { translation: { common: { home: 'Inici', soon: 'Properament' }, header: { fortune: 'Fortuna', game: 'Jocs', contact: 'Contacte' }, home: { searchPlaceholder: 'Cerca eines', heroTitle: 'Eines útils', noResult: 'No s’han trobat resultats.' } } },
  mk: { translation: { common: { home: 'Почетна', soon: 'Наскоро' }, header: { fortune: 'Среќа', game: 'Игри', contact: 'Контакт' }, home: { searchPlaceholder: 'Пребарај алатки', heroTitle: 'Корисни алатки', noResult: 'Нема резултати.' } } },
  tl: { translation: { common: { home: 'Tahanan', soon: 'Malapit na' }, header: { fortune: 'Swerte', game: 'Mga laro', contact: 'Makipag-ugnayan' }, home: { searchPlaceholder: 'Maghanap ng tool', heroTitle: 'Mga kapaki-pakinabang na tool', noResult: 'Walang nahanap na resulta.' } } },
  sq: { translation: { common: { home: 'Kryefaqja', soon: 'Së shpejti' }, header: { fortune: 'Fati', game: 'Lojëra', contact: 'Kontakt' }, home: { searchPlaceholder: 'Kërko mjete', heroTitle: 'Mjete të dobishme', noResult: 'Nuk u gjetën rezultate.' } } },
  eu: { translation: { common: { home: 'Hasiera', soon: 'Laster' }, header: { fortune: 'Zoria', game: 'Jokoak', contact: 'Kontaktua' }, home: { searchPlaceholder: 'Bilatu tresnak', heroTitle: 'Tresna erabilgarriak', noResult: 'Ez da emaitzarik aurkitu.' } } },
  mt: { translation: { common: { home: 'Dar', soon: 'Dalwaqt' }, header: { fortune: 'Fortuna', game: 'Logħob', contact: 'Kuntatt' }, home: { searchPlaceholder: 'Fittex għodod', heroTitle: 'Għodod utli', noResult: 'Ma nstab l-ebda riżultat.' } } },
  ga: { translation: { common: { home: 'Baile', soon: 'Ag teacht go luath' }, header: { fortune: 'Ádh', game: 'Cluichí', contact: 'Teagmháil' }, home: { searchPlaceholder: 'Cuardaigh uirlisí', heroTitle: 'Uirlisí úsáideacha', noResult: 'Níor aimsíodh torthaí.' } } },
  lb: { translation: { common: { home: 'Startsäit', soon: 'Geschwënn' }, header: { fortune: 'Gléck', game: 'Spiller', contact: 'Kontakt' }, home: { searchPlaceholder: 'Tools sichen', heroTitle: 'Nëtzlech Tools', noResult: 'Keng Resultater fonnt.' } } },
  haw: { translation: { common: { home: 'Ka home', soon: 'Koke' }, header: { fortune: 'Laki', game: 'Pāʻani', contact: 'Hoʻokaʻaʻike' }, home: { searchPlaceholder: 'Huli i nā mea hana', heroTitle: 'Nā mea hana pono', noResult: 'ʻAʻohe hopena.' } } },
  ug: { translation: { common: { home: 'باش بەت', soon: 'پات يېقىندا' }, header: { fortune: 'باخت', game: 'ئويۇنلار', contact: 'ئالاقە' }, home: { searchPlaceholder: 'قوراللارنى ئىزدەش', heroTitle: 'پايدىلىق قوراللار', noResult: 'نەتىجە تېپىلمىدى.' } } },
  rw: { translation: { common: { home: 'Ahabanza', soon: 'Biteguye kuza' }, header: { fortune: 'Amahirwe', game: 'Imikino', contact: 'Twandikire' }, home: { searchPlaceholder: 'Shakisha ibikoresho', heroTitle: 'Ibikoresho bifasha', noResult: 'Nta bisubizo bibonetse.' } } },
  eo: { translation: { common: { home: 'Hejmo', soon: 'Baldaŭ' }, header: { fortune: 'Fortuno', game: 'Ludoj', contact: 'Kontakto' }, home: { searchPlaceholder: 'Serĉi ilojn', heroTitle: 'Utilaj iloj', noResult: 'Neniuj rezultoj.' } } },
  cy: { translation: { common: { home: 'Hafan', soon: 'Yn fuan' }, header: { fortune: 'Ffortiwn', game: 'Gemau', contact: 'Cysylltu' }, home: { searchPlaceholder: 'Chwilio am offer', heroTitle: 'Offer defnyddiol', noResult: 'Dim canlyniadau.' } } },
} as const;

// Core chrome copy for the first rollout languages. Tool-specific pages can
// safely fall back to English until their reviewed glossary is added.
const rolloutTranslations = {
  zh: { translation: { common: { home: '首页', soon: '即将推出' }, header: { fortune: '运势', game: '游戏', fishbreadMap: '鲷鱼烧地图', contact: '联系' }, footer: { rights: '版权所有。', about: '关于', privacy: '隐私', terms: '条款', refund: '退款', contact: '联系', editorial: '运营原则', disclaimer: '免责声明' }, home: { searchPlaceholder: '搜索工具', heroTitle: '趣味工具集', heroDesc: '从卡片直接开始。', noResult: '没有找到结果。' } } },
  es: { translation: { common: { home: 'Inicio', soon: 'Próximamente' }, header: { fortune: 'Fortuna', game: 'Juegos', fishbreadMap: 'Mapa de comida', contact: 'Contacto' }, footer: { rights: 'Todos los derechos reservados.', about: 'Acerca de', privacy: 'Privacidad', terms: 'Términos', refund: 'Reembolsos', contact: 'Contacto', editorial: 'Principios editoriales', disclaimer: 'Aviso' }, home: { searchPlaceholder: 'Buscar herramientas', heroTitle: 'Herramientas divertidas', heroDesc: 'Empieza desde una tarjeta.', noResult: 'No se encontraron resultados.' } } },
  de: { translation: { common: { home: 'Startseite', soon: 'Bald verfügbar' }, header: { fortune: 'Horoskop', game: 'Spiele', fishbreadMap: 'Karte', contact: 'Kontakt' }, footer: { rights: 'Alle Rechte vorbehalten.', about: 'Über uns', privacy: 'Datenschutz', terms: 'Bedingungen', refund: 'Erstattungen', contact: 'Kontakt', editorial: 'Redaktionsgrundsätze', disclaimer: 'Haftungsausschluss' }, home: { searchPlaceholder: 'Tools suchen', heroTitle: 'Praktische Tools', heroDesc: 'Direkt über eine Karte starten.', noResult: 'Keine Ergebnisse gefunden.' } } },
  fr: { translation: { common: { home: 'Accueil', soon: 'Bientôt' }, header: { fortune: 'Horoscope', game: 'Jeux', fishbreadMap: 'Carte', contact: 'Contact' }, footer: { rights: 'Tous droits réservés.', about: 'À propos', privacy: 'Confidentialité', terms: 'Conditions', refund: 'Remboursements', contact: 'Contact', editorial: 'Règles éditoriales', disclaimer: 'Avertissement' }, home: { searchPlaceholder: 'Rechercher des outils', heroTitle: 'Outils pratiques', heroDesc: 'Commencez depuis une carte.', noResult: 'Aucun résultat.' } } },
  pt: { translation: { common: { home: 'Início', soon: 'Em breve' }, header: { fortune: 'Fortuna', game: 'Jogos', fishbreadMap: 'Mapa', contact: 'Contato' }, footer: { rights: 'Todos os direitos reservados.', about: 'Sobre', privacy: 'Privacidade', terms: 'Termos', refund: 'Reembolsos', contact: 'Contato', editorial: 'Princípios editoriais', disclaimer: 'Aviso' }, home: { searchPlaceholder: 'Buscar ferramentas', heroTitle: 'Ferramentas práticas', heroDesc: 'Comece por um cartão.', noResult: 'Nenhum resultado.' } } },
  vi: { translation: { common: { home: 'Trang chủ', soon: 'Sắp ra mắt' }, header: { fortune: 'Vận may', game: 'Trò chơi', fishbreadMap: 'Bản đồ', contact: 'Liên hệ' }, footer: { rights: 'Đã đăng ký bản quyền.', about: 'Giới thiệu', privacy: 'Quyền riêng tư', terms: 'Điều khoản', refund: 'Hoàn tiền', contact: 'Liên hệ', editorial: 'Nguyên tắc biên tập', disclaimer: 'Tuyên bố miễn trừ' }, home: { searchPlaceholder: 'Tìm công cụ', heroTitle: 'Bộ công cụ tiện ích', heroDesc: 'Bắt đầu từ một thẻ.', noResult: 'Không tìm thấy kết quả.' } } },
  id: { translation: { common: { home: 'Beranda', soon: 'Segera hadir' }, header: { fortune: 'Ramalan', game: 'Game', fishbreadMap: 'Peta', contact: 'Kontak' }, footer: { rights: 'Hak cipta dilindungi.', about: 'Tentang', privacy: 'Privasi', terms: 'Ketentuan', refund: 'Pengembalian dana', contact: 'Kontak', editorial: 'Prinsip editorial', disclaimer: 'Penafian' }, home: { searchPlaceholder: 'Cari alat', heroTitle: 'Kumpulan alat praktis', heroDesc: 'Mulai dari kartu.', noResult: 'Hasil tidak ditemukan.' } } },
  it: { translation: { common: { home: 'Home', soon: 'Presto disponibile' }, header: { fortune: 'Fortuna', game: 'Giochi', fishbreadMap: 'Mappa', contact: 'Contatti' }, footer: { rights: 'Tutti i diritti riservati.', about: 'Informazioni', privacy: 'Privacy', terms: 'Termini', refund: 'Rimborsi', contact: 'Contatti', editorial: 'Principi editoriali', disclaimer: 'Avvertenza' }, home: { searchPlaceholder: 'Cerca strumenti', heroTitle: 'Strumenti divertenti', heroDesc: 'Inizia da una scheda.', noResult: 'Nessun risultato.' } } },
  nl: { translation: { common: { home: 'Home', soon: 'Binnenkort' }, header: { fortune: 'Horoscoop', game: 'Spellen', fishbreadMap: 'Kaart', contact: 'Contact' }, footer: { rights: 'Alle rechten voorbehouden.', about: 'Over', privacy: 'Privacy', terms: 'Voorwaarden', refund: 'Terugbetalingen', contact: 'Contact', editorial: 'Redactioneel', disclaimer: 'Disclaimer' }, home: { searchPlaceholder: 'Tools zoeken', heroTitle: 'Handige tools', heroDesc: 'Start vanaf een kaart.', noResult: 'Geen resultaten.' } } },
  ru: { translation: { common: { home: 'Главная', soon: 'Скоро' }, header: { fortune: 'Гороскоп', game: 'Игры', fishbreadMap: 'Карта', contact: 'Контакты' }, footer: { rights: 'Все права защищены.', about: 'О нас', privacy: 'Конфиденциальность', terms: 'Условия', refund: 'Возвраты', contact: 'Контакты', editorial: 'Принципы', disclaimer: 'Отказ от ответственности' }, home: { searchPlaceholder: 'Поиск инструментов', heroTitle: 'Полезные инструменты', heroDesc: 'Начните с карточки.', noResult: 'Ничего не найдено.' } } },
  ar: { translation: { common: { home: 'الرئيسية', soon: 'قريباً' }, header: { fortune: 'الحظ', game: 'الألعاب', fishbreadMap: 'الخريطة', contact: 'اتصل بنا' }, footer: { rights: 'جميع الحقوق محفوظة.', about: 'حول', privacy: 'الخصوصية', terms: 'الشروط', refund: 'المبالغ المستردة', contact: 'اتصل بنا', editorial: 'المبادئ التحريرية', disclaimer: 'إخلاء المسؤولية' }, home: { searchPlaceholder: 'ابحث عن الأدوات', heroTitle: 'أدوات ممتعة', heroDesc: 'ابدأ من بطاقة.', noResult: 'لم يتم العثور على نتائج.' } } },
  hi: { translation: { common: { home: 'होम', soon: 'जल्द आ रहा है' }, header: { fortune: 'भाग्य', game: 'गेम', fishbreadMap: 'मानचित्र', contact: 'संपर्क' }, footer: { rights: 'सर्वाधिकार सुरक्षित।', about: 'परिचय', privacy: 'गोपनीयता', terms: 'शर्तें', refund: 'रिफंड', contact: 'संपर्क', editorial: 'संपादकीय नीति', disclaimer: 'अस्वीकरण' }, home: { searchPlaceholder: 'टूल खोजें', heroTitle: 'मज़ेदार टूल', heroDesc: 'कार्ड से शुरू करें।', noResult: 'कोई परिणाम नहीं।' } } },
  tr: { translation: { common: { home: 'Ana sayfa', soon: 'Yakında' }, header: { fortune: 'Fal', game: 'Oyun', fishbreadMap: 'Harita', contact: 'İletişim' }, footer: { rights: 'Tüm hakları saklıdır.', about: 'Hakkımızda', privacy: 'Gizlilik', terms: 'Koşullar', refund: 'İadeler', contact: 'İletişim', editorial: 'Yayın ilkeleri', disclaimer: 'Sorumluluk reddi' }, home: { searchPlaceholder: 'Araç ara', heroTitle: 'Eğlenceli araçlar', heroDesc: 'Bir karttan başlayın.', noResult: 'Sonuç bulunamadı.' } } },
  pl: { translation: { common: { home: 'Start', soon: 'Wkrótce' }, header: { fortune: 'Horoskop', game: 'Gry', fishbreadMap: 'Mapa', contact: 'Kontakt' }, footer: { rights: 'Wszelkie prawa zastrzeżone.', about: 'O nas', privacy: 'Prywatność', terms: 'Warunki', refund: 'Zwroty', contact: 'Kontakt', editorial: 'Zasady redakcyjne', disclaimer: 'Zastrzeżenie' }, home: { searchPlaceholder: 'Szukaj narzędzi', heroTitle: 'Przydatne narzędzia', heroDesc: 'Zacznij od karty.', noResult: 'Brak wyników.' } } },
  th: { translation: { common: { home: 'หน้าหลัก', soon: 'เร็ว ๆ นี้' }, header: { fortune: 'ดวงชะตา', game: 'เกม', fishbreadMap: 'แผนที่', contact: 'ติดต่อ' }, footer: { rights: 'สงวนลิขสิทธิ์', about: 'เกี่ยวกับ', privacy: 'ความเป็นส่วนตัว', terms: 'เงื่อนไข', refund: 'การคืนเงิน', contact: 'ติดต่อ', editorial: 'หลักบรรณาธิการ', disclaimer: 'ข้อจำกัดความรับผิดชอบ' }, home: { searchPlaceholder: 'ค้นหาเครื่องมือ', heroTitle: 'เครื่องมือสนุก ๆ', heroDesc: 'เริ่มจากการ์ด', noResult: 'ไม่พบผลลัพธ์' } } },
  sv: { translation: { common: { home: 'Hem', soon: 'Kommer snart' }, header: { fortune: 'Horoskop', game: 'Spel', fishbreadMap: 'Karta', contact: 'Kontakt' }, footer: { rights: 'Med ensamrätt.', about: 'Om oss', privacy: 'Integritet', terms: 'Villkor', refund: 'Återbetalningar', contact: 'Kontakt', editorial: 'Redaktionella principer', disclaimer: 'Ansvarsfriskrivning' }, home: { searchPlaceholder: 'Sök verktyg', heroTitle: 'Praktiska verktyg', heroDesc: 'Börja från ett kort.', noResult: 'Inga resultat.' } } },
  uk: { translation: { common: { home: 'Головна', soon: 'Незабаром' }, header: { fortune: 'Гороскоп', game: 'Ігри', fishbreadMap: 'Мапа', contact: 'Контакти' }, footer: { rights: 'Усі права захищено.', about: 'Про нас', privacy: 'Конфіденційність', terms: 'Умови', refund: 'Повернення', contact: 'Контакти', editorial: 'Редакційні принципи', disclaimer: 'Відмова від відповідальності' }, home: { searchPlaceholder: 'Пошук інструментів', heroTitle: 'Корисні інструменти', heroDesc: 'Почніть із картки.', noResult: 'Результатів не знайдено.' } } }
  ,ca: { translation: { common: { home: 'Inici', soon: 'Properament' }, header: { fortune: 'Fortuna', game: 'Jocs', fishbreadMap: 'Mapa', contact: 'Contacte' }, footer: { rights: 'Tots els drets reservats.', about: 'Sobre', privacy: 'Privacitat', terms: 'Condicions', refund: 'Reemborsaments', contact: 'Contacte', editorial: 'Principis editorials', disclaimer: 'Avís' }, home: { searchPlaceholder: 'Cerca eines', heroTitle: 'Eines pràctiques', heroDesc: 'Comença des d’una targeta.', noResult: 'No s’han trobat resultats.' } } },
  cs: { translation: { common: { home: 'Domů', soon: 'Již brzy' }, header: { fortune: 'Horoskop', game: 'Hry', fishbreadMap: 'Mapa', contact: 'Kontakt' }, footer: { rights: 'Všechna práva vyhrazena.', about: 'O nás', privacy: 'Soukromí', terms: 'Podmínky', refund: 'Vrácení peněz', contact: 'Kontakt', editorial: 'Redakční zásady', disclaimer: 'Upozornění' }, home: { searchPlaceholder: 'Hledat nástroje', heroTitle: 'Praktické nástroje', heroDesc: 'Začněte kartou.', noResult: 'Nebyly nalezeny žádné výsledky.' } } },
  da: { translation: { common: { home: 'Hjem', soon: 'Kommer snart' }, header: { fortune: 'Horoskop', game: 'Spil', fishbreadMap: 'Kort', contact: 'Kontakt' }, footer: { rights: 'Alle rettigheder forbeholdes.', about: 'Om', privacy: 'Privatliv', terms: 'Vilkår', refund: 'Refusioner', contact: 'Kontakt', editorial: 'Redaktionelle principper', disclaimer: 'Ansvarsfraskrivelse' }, home: { searchPlaceholder: 'Søg værktøjer', heroTitle: 'Praktiske værktøjer', heroDesc: 'Start fra et kort.', noResult: 'Ingen resultater.' } } },
  fi: { translation: { common: { home: 'Etusivu', soon: 'Tulossa pian' }, header: { fortune: 'Ennustus', game: 'Pelit', fishbreadMap: 'Kartta', contact: 'Yhteystiedot' }, footer: { rights: 'Kaikki oikeudet pidätetään.', about: 'Tietoa', privacy: 'Tietosuoja', terms: 'Ehdot', refund: 'Hyvitykset', contact: 'Yhteystiedot', editorial: 'Toimitusperiaatteet', disclaimer: 'Vastuuvapauslauseke' }, home: { searchPlaceholder: 'Hae työkaluja', heroTitle: 'Käteviä työkaluja', heroDesc: 'Aloita kortista.', noResult: 'Tuloksia ei löytynyt.' } } },
  no: { translation: { common: { home: 'Hjem', soon: 'Kommer snart' }, header: { fortune: 'Horoskop', game: 'Spill', fishbreadMap: 'Kart', contact: 'Kontakt' }, footer: { rights: 'Alle rettigheter forbeholdt.', about: 'Om', privacy: 'Personvern', terms: 'Vilkår', refund: 'Refusjoner', contact: 'Kontakt', editorial: 'Redaksjonelle prinsipper', disclaimer: 'Ansvarsfraskrivelse' }, home: { searchPlaceholder: 'Søk etter verktøy', heroTitle: 'Praktiske verktøy', heroDesc: 'Start fra et kort.', noResult: 'Ingen resultater.' } } },
  ro: { translation: { common: { home: 'Acasă', soon: 'În curând' }, header: { fortune: 'Horoscop', game: 'Jocuri', fishbreadMap: 'Hartă', contact: 'Contact' }, footer: { rights: 'Toate drepturile rezervate.', about: 'Despre', privacy: 'Confidențialitate', terms: 'Termeni', refund: 'Rambursări', contact: 'Contact', editorial: 'Principii editoriale', disclaimer: 'Declinarea răspunderii' }, home: { searchPlaceholder: 'Caută instrumente', heroTitle: 'Instrumente utile', heroDesc: 'Începe de pe un card.', noResult: 'Nu s-au găsit rezultate.' } } },
  el: { translation: { common: { home: 'Αρχική', soon: 'Σύντομα' }, header: { fortune: 'Τύχη', game: 'Παιχνίδια', fishbreadMap: 'Χάρτης', contact: 'Επικοινωνία' }, footer: { rights: 'Με επιφύλαξη παντός δικαιώματος.', about: 'Σχετικά', privacy: 'Απόρρητο', terms: 'Όροι', refund: 'Επιστροφές', contact: 'Επικοινωνία', editorial: 'Συντακτικές αρχές', disclaimer: 'Αποποίηση ευθύνης' }, home: { searchPlaceholder: 'Αναζήτηση εργαλείων', heroTitle: 'Χρήσιμα εργαλεία', heroDesc: 'Ξεκινήστε από μια κάρτα.', noResult: 'Δεν βρέθηκαν αποτελέσματα.' } } },
  he: { translation: { common: { home: 'בית', soon: 'בקרוב' }, header: { fortune: 'מזל', game: 'משחקים', fishbreadMap: 'מפה', contact: 'צור קשר' }, footer: { rights: 'כל הזכויות שמורות.', about: 'אודות', privacy: 'פרטיות', terms: 'תנאים', refund: 'החזרים', contact: 'צור קשר', editorial: 'עקרונות עריכה', disclaimer: 'כתב ויתור' }, home: { searchPlaceholder: 'חיפוש כלים', heroTitle: 'כלים שימושיים', heroDesc: 'מתחילים מכרטיס.', noResult: 'לא נמצאו תוצאות.' } } },
  hu: { translation: { common: { home: 'Kezdőlap', soon: 'Hamarosan' }, header: { fortune: 'Horoszkóp', game: 'Játékok', fishbreadMap: 'Térkép', contact: 'Kapcsolat' }, footer: { rights: 'Minden jog fenntartva.', about: 'Rólunk', privacy: 'Adatvédelem', terms: 'Feltételek', refund: 'Visszatérítés', contact: 'Kapcsolat', editorial: 'Szerkesztési elvek', disclaimer: 'Jogi nyilatkozat' }, home: { searchPlaceholder: 'Eszközök keresése', heroTitle: 'Hasznos eszközök', heroDesc: 'Kezdje egy kártyával.', noResult: 'Nincs találat.' } } }
} as const;

export function detectLocale(pathname: string): Locale {
  const prefix = pathname.match(/^\/([a-z]{2})(?:\/|$)/)?.[1];
  if (prefix && (seoLocaleCodes as readonly string[]).includes(prefix)) return prefix as Locale;
  return 'ko';
}

export function stripLocale(pathname: string) {
  return pathname.replace(new RegExp(`^\\/(${seoLocaleCodes.filter((code) => code !== 'ko').join('|')})(?=\\/|$)`), '') || '/';
}

// /en, /ja 페이지 대부분은 한국어 페이지를 그대로 렌더링하는 래퍼라서,
// 본문까지 실제 번역된 경로만 여기에 등록한다. (locale prefix 제외 경로 기준)
const translatedPaths: Record<string, RegExp[]> = {
  en: [/^\/ai-image-generator(\/[^/]+)?$/, /^\/tools\/product-detail-studio(\/result)?$/],
  ja: [/^\/tools\/product-detail-studio(\/result)?$/],
};

const rolloutSeoPath = /^\/(ai-image-generator(?:\/[^/]+)?|ai-personal-color|ai-calorie-calculator|ai-manseryeok|ai-id-photo|ai-headshot|ai-pet-translator|valorant-agent-picker|crosshair-generator|fps-aim-sensitivity|fps-aim-trainer|fps-sensitivity-converter|dpi-edpi-calculator|fov-calculator|name-compatibility|nickname-generator|name-meaning|random-picker|chat-random-picker|lol-champion-recommender|game-character-picker)$/;
for (const code of localeCodes) {
  if (code !== 'ko' && !translatedPaths[code]) translatedPaths[code] = [rolloutSeoPath];
}

export function hasTranslation(locale: Locale, path: string) {
  if (locale === 'ko') return true;
  const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;
  if (normalized === '/' || /^\/(ai-personal-color|ai-calorie-calculator|ai-manseryeok|ai-id-photo|ai-headshot|ai-pet-translator|valorant-agent-picker|crosshair-generator|fps-aim-sensitivity|fps-aim-trainer|fps-sensitivity-converter|dpi-edpi-calculator|fov-calculator|name-compatibility|nickname-generator|name-meaning|random-picker|chat-random-picker|lol-champion-recommender|game-character-picker|image-compressor|image-resizer|image-blur|image-cropper|unit-converter|bmi-calculator|percentage-calculator|color-converter|time-zone-converter|tip-calculator|age-calculator)$/.test(normalized)) return true;
  return Boolean(translatedPaths[locale]?.some((pattern) => pattern.test(normalized)));
}

export function getLocalePrefix(locale: Locale) {
  return locale === 'ko' ? '' : `/${locale}`;
}

export function withLocalePath(locale: Locale, path: string) {
  const prefix = getLocalePrefix(locale);
  const normalized = path === '/' ? '' : path;
  return `${prefix}${normalized || '/'}`.replace(/\/{2,}/g, '/');
}

export async function createTranslator(locale: Locale) {
  const instance = i18next.createInstance();
  await instance.init({
    lng: locale,
    fallbackLng: 'en',
    resources: { ...resources, ...rolloutTranslations, ...additionalTranslations, ...extendedTranslations, ...regionalTranslations, ...globalTranslations, ...finalRegionalTranslations, ...lastTranslations, ...edgeTranslations },
    interpolation: { escapeValue: false },
    initImmediate: false,
  });
  return instance.getFixedT(locale);
}
