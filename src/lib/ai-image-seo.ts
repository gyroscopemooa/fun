import type { AiImageMode } from '../components/home/AiImageGenerator';

type Locale = 'ko' | 'en';

type SeoEntry = {
  slug: string;
  mode: AiImageMode;
  title: string;
  description: string;
  keywords: string;
  heading: string;
  intro: string;
  faqTitle: string;
  faq: Array<{ q: string; a: string }>;
};

type ModeSpec = {
  mode: AiImageMode;
  slug: string;
  ko: {
    title: string;
    desc: string;
    keywords: string;
    heading: string;
    intro: string;
    faqTitle: string;
    faq: Array<{ q: string; a: string }>;
  };
  en: {
    title: string;
    desc: string;
    keywords: string;
    heading: string;
    intro: string;
    faqTitle: string;
    faq: Array<{ q: string; a: string }>;
  };
};

const SPECS: ModeSpec[] = [
  {
    mode: 'figure',
    slug: 'figure',
    ko: {
      title: 'AI 피규어 만들기 | 액션피규어 이미지 생성기 | ManyTool',
      desc: '사진 한 장으로 박스형 액션피규어 스타일 이미지를 생성하는 AI 피규어 만들기 도구입니다.',
      keywords: 'AI 피규어 만들기, AI 피규어 생성기, 액션피규어 이미지 생성, 사진으로 피규어 만들기',
      heading: 'AI 피규어 만들기',
      intro: '얼굴 특징은 유지하고 패키지형 액션피규어 상품 이미지처럼 변환합니다.',
      faqTitle: 'AI 피규어 FAQ',
      faq: [
        { q: '셀카로도 만들 수 있나요?', a: '가능합니다. 얼굴이 잘 보이는 사진일수록 결과가 안정적입니다.' },
        { q: '상품 박스 느낌으로 나오나요?', a: '박스형 피규어 상품 이미지 스타일을 목표로 생성합니다.' }
      ]
    },
    en: {
      title: 'AI Action Figure Generator | Photo to Figure | ManyTool',
      desc: 'Turn one photo into a boxed action figure style image with an AI action figure generator.',
      keywords: 'AI action figure generator, photo to figure, action figure image maker, AI figure maker',
      heading: 'AI Action Figure Generator',
      intro: 'Keep identity cues while transforming your upload into a packaged action figure style image.',
      faqTitle: 'Action Figure FAQ',
      faq: [
        { q: 'Can I use a selfie?', a: 'Yes. Clear face visibility usually improves the output.' },
        { q: 'Does it look like a retail figure box?', a: 'The mode is tuned toward boxed action figure presentation.' }
      ]
    }
  },
  {
    mode: 'body',
    slug: 'body-profile',
    ko: {
      title: 'AI 바디프로필 생성기 | 운동 사진 스타일 변환 | ManyTool',
      desc: '일반 사진을 바디프로필 촬영 느낌의 AI 이미지로 바꾸는 바디프로필 생성기입니다.',
      keywords: 'AI 바디프로필, 바디프로필 생성기, 운동 사진 변환, 헬스 사진 AI',
      heading: 'AI 바디프로필 생성기',
      intro: '한 장의 사진으로 스튜디오 바디프로필 분위기의 이미지를 만듭니다.',
      faqTitle: '바디프로필 FAQ',
      faq: [
        { q: '헬스장 사진도 가능한가요?', a: '가능합니다. 상반신과 전신이 잘 보일수록 유리합니다.' },
        { q: '얼굴이 많이 바뀌나요?', a: '기본적으로 인물 정체성 유지 방향으로 생성됩니다.' }
      ]
    },
    en: {
      title: 'AI Fitness Photoshoot Generator | Body Profile Image | ManyTool',
      desc: 'Create fitness photoshoot and body profile style images from a regular portrait with AI.',
      keywords: 'AI fitness photoshoot, body profile generator, gym photo AI, fitness portrait generator',
      heading: 'AI Fitness Photoshoot Generator',
      intro: 'Convert a normal portrait into a polished body profile or fitness studio style image.',
      faqTitle: 'Fitness FAQ',
      faq: [
        { q: 'Do gym photos work?', a: 'Yes. Photos with clear body shape and lighting tend to work better.' },
        { q: 'Is identity preserved?', a: 'The generator aims to keep face identity and overall likeness.' }
      ]
    }
  },
  {
    mode: 'travel',
    slug: 'travel-background',
    ko: {
      title: 'AI 여행 배경 생성기 | 해외여행 사진 배경 바꾸기 | ManyTool',
      desc: '인물은 유지하고 배경만 해외여행 느낌으로 바꾸는 AI 여행 배경 생성기입니다.',
      keywords: 'AI 여행 배경, 해외여행 배경 바꾸기, 여행 사진 생성, AI 여행사진',
      heading: 'AI 여행 배경 생성기',
      intro: '현재 사진의 인물은 유지하고 여행지 분위기의 배경으로 자연스럽게 바꿉니다.',
      faqTitle: '여행 배경 FAQ',
      faq: [
        { q: '실내 사진도 바꿀 수 있나요?', a: '가능합니다. 인물이 잘 분리된 사진일수록 자연스럽습니다.' },
        { q: '배경만 바뀌나요?', a: '기본 목적은 배경 전환이지만 전체 톤도 함께 조정될 수 있습니다.' }
      ]
    },
    en: {
      title: 'AI Travel Background Generator | Vacation Photo Editor | ManyTool',
      desc: 'Keep the person and change the background into an overseas travel scene with AI.',
      keywords: 'AI travel background generator, vacation photo editor, travel scene AI, overseas background changer',
      heading: 'AI Travel Background Generator',
      intro: 'Swap the setting around your subject into a travel or vacation style background.',
      faqTitle: 'Travel Background FAQ',
      faq: [
        { q: 'Can I use indoor photos?', a: 'Yes. Cleaner subject separation usually gives better results.' },
        { q: 'Does only the background change?', a: 'The background is the main target, but overall color mood can shift too.' }
      ]
    }
  },
  {
    mode: 'europe',
    slug: 'europe-style',
    ko: {
      title: 'AI 유럽여행 스타일 생성기 | 유럽 감성 사진 만들기 | ManyTool',
      desc: '유럽 여행 감성의 거리, 카페, 골목 무드로 사진을 변환하는 AI 유럽여행 스타일 생성기입니다.',
      keywords: 'AI 유럽여행 스타일, 유럽 감성 사진, 파리 스타일 사진, 여행 무드 생성기',
      heading: 'AI 유럽여행 스타일 생성기',
      intro: '도시 여행 감성과 유럽 카페 분위기를 살린 사진 스타일로 변환합니다.',
      faqTitle: '유럽여행 스타일 FAQ',
      faq: [
        { q: '배경과 색감이 같이 바뀌나요?', a: '네. 장소 무드와 톤을 함께 조정하는 방향으로 생성됩니다.' },
        { q: '셀카도 가능한가요?', a: '가능합니다. 얼굴과 상반신이 또렷하면 더 안정적입니다.' }
      ]
    },
    en: {
      title: 'AI Europe Travel Style Generator | European Mood Photo | ManyTool',
      desc: 'Transform a portrait into a Europe-inspired travel image with city, cafe, and street mood styling.',
      keywords: 'AI Europe travel style, European mood photo, Paris style portrait, travel mood generator',
      heading: 'AI Europe Travel Style Generator',
      intro: 'Apply a European city, cafe, and travel atmosphere to your uploaded photo.',
      faqTitle: 'Europe Style FAQ',
      faq: [
        { q: 'Do color tone and background change together?', a: 'Yes. This mode adjusts overall travel mood as well as scene styling.' },
        { q: 'Can I use a selfie?', a: 'Yes. Clear face and upper-body framing usually works best.' }
      ]
    }
  },
  {
    mode: 'proofshot',
    slug: 'snapshot',
    ko: {
      title: 'AI 인생샷 만들기 | 자연스러운 스냅 사진 생성기 | ManyTool',
      desc: '셀카나 일반 사진을 자연스러운 스냅샷 느낌으로 바꾸는 AI 인생샷 만들기 도구입니다.',
      keywords: 'AI 인생샷, 스냅 사진 생성기, 자연스러운 프로필 사진, 여행 스냅 AI',
      heading: 'AI 인생샷 만들기',
      intro: '과한 보정 느낌보다 실제 촬영한 듯한 자연스러운 스냅 무드를 목표로 합니다.',
      faqTitle: '인생샷 FAQ',
      faq: [
        { q: '보정이 너무 세게 들어가나요?', a: '이 모드는 비교적 자연스러운 결과를 지향합니다.' },
        { q: 'SNS용 사진으로 써도 되나요?', a: '네. 가벼운 프로필, 스토리, 피드용으로 잘 맞습니다.' }
      ]
    },
    en: {
      title: 'AI Snapshot Generator | Natural Candid Photo Style | ManyTool',
      desc: 'Turn a selfie or portrait into a natural-looking snapshot style image with AI.',
      keywords: 'AI snapshot generator, candid photo style, natural social profile image, travel snapshot AI',
      heading: 'AI Snapshot Generator',
      intro: 'This mode aims for a believable candid look instead of heavy stylization.',
      faqTitle: 'Snapshot FAQ',
      faq: [
        { q: 'Is the effect very strong?', a: 'No. This mode leans toward a more natural photo result.' },
        { q: 'Can I use it for social media?', a: 'Yes. It works well for profile, story, and feed-style images.' }
      ]
    }
  },
  {
    mode: 'kakao',
    slug: 'kakao-profile',
    ko: {
      title: 'AI 카톡 프로필 생성기 | 깔끔한 프사 만들기 | ManyTool',
      desc: '카카오톡 프로필에 어울리는 깔끔한 인물 이미지를 만드는 AI 카톡 프로필 생성기입니다.',
      keywords: 'AI 카톡 프로필, 카톡 프사 만들기, 프로필 사진 생성기, 깔끔한 프사',
      heading: 'AI 카톡 프로필 생성기',
      intro: '과하지 않고 단정한 프로필 사진이 필요할 때 쓰기 좋은 모드입니다.',
      faqTitle: '카톡 프로필 FAQ',
      faq: [
        { q: '증명사진처럼 딱딱하게 나오나요?', a: '아니요. 프로필용으로 조금 더 부드럽고 자연스럽게 생성됩니다.' },
        { q: '배경도 정리되나요?', a: '네. 프로필에 맞는 깔끔한 톤으로 정리될 수 있습니다.' }
      ]
    },
    en: {
      title: 'AI Social Profile Generator | Clean Profile Photo | ManyTool',
      desc: 'Generate a clean, profile-ready portrait suitable for messaging apps and social profiles.',
      keywords: 'AI social profile generator, clean profile photo, messaging app portrait, profile image maker',
      heading: 'AI Social Profile Generator',
      intro: 'Use this mode when you need a tidy, simple, profile-friendly portrait.',
      faqTitle: 'Profile FAQ',
      faq: [
        { q: 'Does it look like an ID photo?', a: 'No. It stays softer and more casual than a formal ID photo.' },
        { q: 'Will the background be cleaned up?', a: 'Yes. The output often shifts toward a cleaner profile-friendly tone.' }
      ]
    }
  },
  {
    mode: 'instagram',
    slug: 'instagram-photo',
    ko: {
      title: 'AI 인스타 사진 생성기 | 감성 프로필 사진 만들기 | ManyTool',
      desc: '트렌디한 인스타그램 감성의 프로필 사진과 라이프스타일 이미지를 만드는 AI 도구입니다.',
      keywords: 'AI 인스타 사진, 인스타 감성 사진, 프로필 사진 생성기, AI 프로필 이미지',
      heading: 'AI 인스타 사진 생성기',
      intro: '인스타그램에 어울리는 감성적인 무드와 라이프스타일 스타일로 이미지를 생성합니다.',
      faqTitle: '인스타 사진 FAQ',
      faq: [
        { q: '카톡 프사와는 다른가요?', a: '인스타용은 좀 더 라이프스타일, 에디토리얼 무드에 가깝습니다.' },
        { q: '혼자 나온 사진이 더 좋은가요?', a: '네. 얼굴과 상체가 뚜렷한 단독 사진이 가장 안정적입니다.' }
      ]
    },
    en: {
      title: 'AI Instagram Photo Generator | Social Profile Image | ManyTool',
      desc: 'Generate trendy Instagram-ready profile and lifestyle images from one uploaded photo.',
      keywords: 'AI Instagram photo generator, social profile image, lifestyle portrait AI, Instagram style photo',
      heading: 'AI Instagram Photo Generator',
      intro: 'Create a lifestyle-focused, polished image style suitable for Instagram profiles and posts.',
      faqTitle: 'Instagram Photo FAQ',
      faq: [
        { q: 'How is it different from a basic profile photo?', a: 'This mode leans more editorial and lifestyle-oriented.' },
        { q: 'Is a solo portrait best?', a: 'Yes. Single-person photos with a clear face tend to perform best.' }
      ]
    }
  },
  {
    mode: 'hanbok',
    slug: 'hanbok',
    ko: {
      title: 'AI 한복 스타일 생성기 | 한복 사진 만들기 | ManyTool',
      desc: '일반 인물 사진을 우아한 한복 스타일 이미지로 변환하는 AI 한복 생성기입니다.',
      keywords: 'AI 한복, 한복 사진 만들기, 한복 스타일 생성기, AI 전통의상',
      heading: 'AI 한복 스타일 생성기',
      intro: '얼굴은 유지하면서 의상과 무드를 한복 스타일로 자연스럽게 바꿉니다.',
      faqTitle: '한복 스타일 FAQ',
      faq: [
        { q: '셀카도 한복 스타일로 되나요?', a: '가능합니다. 정면에 가깝고 얼굴이 선명한 사진이 좋습니다.' },
        { q: '배경도 함께 바뀌나요?', a: '의상 중심이지만 장면 분위기까지 함께 조정될 수 있습니다.' }
      ]
    },
    en: {
      title: 'AI Hanbok Style Generator | Hanbok Photo Maker | ManyTool',
      desc: 'Transform a portrait into an elegant hanbok-inspired image while keeping the face recognizable.',
      keywords: 'AI hanbok style generator, hanbok photo maker, traditional outfit AI, Korean outfit generator',
      heading: 'AI Hanbok Style Generator',
      intro: 'Restyle the clothing and visual mood into an elegant hanbok-inspired look.',
      faqTitle: 'Hanbok FAQ',
      faq: [
        { q: 'Can I use a selfie?', a: 'Yes. Front-facing photos with a visible face usually work best.' },
        { q: 'Will the background also change?', a: 'It can. The main goal is outfit restyling, but scene mood may shift too.' }
      ]
    }
  },
  {
    mode: 'kimono',
    slug: 'kimono',
    ko: {
      title: 'AI 기모노 스타일 생성기 | 기모노 사진 만들기 | ManyTool',
      desc: '인물은 유지하고 의상과 분위기를 기모노 스타일로 바꾸는 AI 기모노 생성기입니다.',
      keywords: 'AI 기모노, 기모노 스타일 생성기, 일본 전통의상 사진, AI 의상 변경',
      heading: 'AI 기모노 스타일 생성기',
      intro: '의상 중심의 변화를 원할 때 적합한 기모노 스타일 전용 모드입니다.',
      faqTitle: '기모노 스타일 FAQ',
      faq: [
        { q: '얼굴은 유지되나요?', a: '기본적으로 인물 인상을 유지하는 방향으로 생성됩니다.' },
        { q: '일본풍 배경도 생기나요?', a: '장면 분위기까지 함께 조정될 수 있습니다.' }
      ]
    },
    en: {
      title: 'AI Kimono Style Generator | Kimono Photo Maker | ManyTool',
      desc: 'Preserve the subject while transforming the outfit and mood into a kimono-inspired style.',
      keywords: 'AI kimono style generator, kimono photo maker, Japanese outfit AI, outfit restyle generator',
      heading: 'AI Kimono Style Generator',
      intro: 'Use this mode when you want outfit-focused transformation with a kimono-inspired result.',
      faqTitle: 'Kimono FAQ',
      faq: [
        { q: 'Is the face preserved?', a: 'The generator aims to keep the person recognizable.' },
        { q: 'Can the background become more Japanese in mood?', a: 'Yes. The scene atmosphere may shift along with the outfit.' }
      ]
    }
  },
  {
    mode: 'outfit',
    slug: 'outfit-change',
    ko: {
      title: 'AI 의상변경 생성기 | 옷 갈아입히기 사진 변환 | ManyTool',
      desc: '인물은 유지하고 의상만 바꾸는 AI 의상변경 생성기입니다.',
      keywords: 'AI 의상변경, 옷 갈아입히기, 패션 사진 변환, AI 옷 변경',
      heading: 'AI 의상변경 생성기',
      intro: '얼굴과 분위기는 유지하면서 옷 스타일만 바꾸고 싶을 때 적합합니다.',
      faqTitle: '의상변경 FAQ',
      faq: [
        { q: '배경은 그대로인가요?', a: '주요 대상은 의상이지만 톤 변화는 일부 있을 수 있습니다.' },
        { q: '패션 룩북 느낌도 가능한가요?', a: '추가 프롬프트로 원하는 스타일을 보정할 수 있습니다.' }
      ]
    },
    en: {
      title: 'AI Outfit Change Generator | Clothing Restyle Photo | ManyTool',
      desc: 'Change only the outfit while keeping the person recognizable with an AI outfit restyle generator.',
      keywords: 'AI outfit change generator, clothing restyle photo, fashion portrait AI, outfit swap generator',
      heading: 'AI Outfit Change Generator',
      intro: 'This mode is useful when you want to update clothing style without changing the person.',
      faqTitle: 'Outfit Change FAQ',
      faq: [
        { q: 'Does the background stay the same?', a: 'The outfit is the main target, though some tone changes can happen.' },
        { q: 'Can I aim for a lookbook mood?', a: 'Yes. Extra prompt text can help steer the fashion direction.' }
      ]
    }
  },
  {
    mode: 'streamer',
    slug: 'streamer-promo',
    ko: {
      title: 'AI 방송인 이미지 생성기 | 스트리머 프로모 사진 | ManyTool',
      desc: '방송 썸네일, 프로모션, 채널 소개에 어울리는 AI 스트리머 이미지 생성기입니다.',
      keywords: 'AI 스트리머 이미지, 방송인 사진 생성기, 썸네일 프로모 이미지, 스트리머 프로필',
      heading: 'AI 방송인 이미지 생성기',
      intro: '스트리머, 크리에이터, 방송용 홍보 이미지 분위기에 맞춘 모드입니다.',
      faqTitle: '스트리머 이미지 FAQ',
      faq: [
        { q: '썸네일 느낌으로도 되나요?', a: '가능합니다. 강한 조명과 배경 무드를 함께 만들 수 있습니다.' },
        { q: '프로필사진으로도 쓸 수 있나요?', a: '네. 채널 이미지용 프로필 컷으로도 적합합니다.' }
      ]
    },
    en: {
      title: 'AI Streamer Promo Generator | Creator Promo Image | ManyTool',
      desc: 'Create streamer, creator, and thumbnail-style promo images from one uploaded photo.',
      keywords: 'AI streamer promo generator, creator promo image, thumbnail portrait AI, streamer profile image',
      heading: 'AI Streamer Promo Generator',
      intro: 'This mode is tuned for creators, streamers, and broadcast-style promotional visuals.',
      faqTitle: 'Streamer Promo FAQ',
      faq: [
        { q: 'Can it work like a thumbnail image?', a: 'Yes. It can generate stronger lighting and promo-style mood.' },
        { q: 'Can I use it for a profile image too?', a: 'Yes. It also fits creator profile and channel identity shots.' }
      ]
    }
  },
  {
    mode: 'pethuman',
    slug: 'pet-humanizer',
    ko: {
      title: 'AI 강아지 사람 만들기 | 반려동물 인간화 생성기 | ManyTool',
      desc: '반려동물 사진을 사람처럼 해석한 캐릭터형 인물 이미지로 바꾸는 AI 인간화 도구입니다.',
      keywords: 'AI 강아지 사람 만들기, 반려동물 인간화, 펫 휴먼라이저, 동물 사람화',
      heading: 'AI 반려동물 인간화',
      intro: '반려동물의 표정과 분위기를 살려 사람 캐릭터처럼 표현하는 모드입니다.',
      faqTitle: '반려동물 인간화 FAQ',
      faq: [
        { q: '고양이도 가능한가요?', a: '네. 강아지와 고양이 모두 활용할 수 있습니다.' },
        { q: '동물 특징이 남나요?', a: '색감, 표정, 분위기 같은 요소가 반영되도록 생성됩니다.' }
      ]
    },
    en: {
      title: 'AI Pet Humanizer | Pet to Human Portrait | ManyTool',
      desc: 'Turn a pet photo into a humanized portrait inspired by your pet’s character and mood.',
      keywords: 'AI pet humanizer, pet to human portrait, animal humanizer AI, dog human portrait',
      heading: 'AI Pet Humanizer',
      intro: 'This mode interprets your pet’s expression and mood as a human-style portrait.',
      faqTitle: 'Pet Humanizer FAQ',
      faq: [
        { q: 'Does it work for cats too?', a: 'Yes. Both cats and dogs work well.' },
        { q: 'Are pet traits preserved?', a: 'Color tone, expression, and overall vibe are often carried into the result.' }
      ]
    }
  },
  {
    mode: 'hairstyle',
    slug: 'hairstyle',
    ko: {
      title: 'AI 헤어스타일 시뮬레이터 | 머리 스타일 바꾸기 | ManyTool',
      desc: '얼굴은 유지하고 헤어스타일만 바꿔보는 AI 헤어스타일 시뮬레이터입니다.',
      keywords: 'AI 헤어스타일, 머리 스타일 바꾸기, 헤어 시뮬레이터, 앞머리 테스트',
      heading: 'AI 헤어스타일 시뮬레이터',
      intro: '커트, 컬, 앞머리, 분위기 변화를 가볍게 확인하고 싶을 때 유용합니다.',
      faqTitle: '헤어스타일 FAQ',
      faq: [
        { q: '얼굴은 그대로 두고 머리만 바뀌나요?', a: '그 방향으로 설계되어 있지만 일부 보정은 함께 일어날 수 있습니다.' },
        { q: '미용실 상담용 참고로 써도 되나요?', a: '네. 가벼운 스타일 참고 이미지로 활용할 수 있습니다.' }
      ]
    },
    en: {
      title: 'AI Hairstyle Simulator | Hair Style Preview | ManyTool',
      desc: 'Preview hairstyle changes while keeping the face recognizable with an AI hairstyle simulator.',
      keywords: 'AI hairstyle simulator, hair style preview, bangs test AI, haircut preview portrait',
      heading: 'AI Hairstyle Simulator',
      intro: 'Useful for quickly testing haircut, bangs, curl, and overall hair mood changes.',
      faqTitle: 'Hairstyle FAQ',
      faq: [
        { q: 'Does it mostly change only the hair?', a: 'That is the main goal, though light image adjustments can happen too.' },
        { q: 'Can I use it for salon reference?', a: 'Yes. It works well as a quick visual reference.' }
      ]
    }
  },
  {
    mode: 'interior',
    slug: 'interior',
    ko: {
      title: 'AI 인테리어 시뮬레이터 | 방 사진 분위기 바꾸기 | ManyTool',
      desc: '방, 거실, 카페 공간 사진을 새로운 인테리어 무드로 바꾸는 AI 인테리어 시뮬레이터입니다.',
      keywords: 'AI 인테리어, 방 사진 분위기 바꾸기, 인테리어 시뮬레이터, 공간 스타일 변환',
      heading: 'AI 인테리어 시뮬레이터',
      intro: '집, 카페, 호텔 느낌처럼 공간 분위기를 바꿔보는 데 적합합니다.',
      faqTitle: '인테리어 FAQ',
      faq: [
        { q: '사람 사진이 아니라 공간 사진도 되나요?', a: '네. 이 모드는 실내 공간 이미지를 기준으로 설계됐습니다.' },
        { q: '가구 배치도 달라질 수 있나요?', a: '전체 공간 무드와 소품 구성이 함께 달라질 수 있습니다.' }
      ]
    },
    en: {
      title: 'AI Interior Simulator | Room Mood Restyle | ManyTool',
      desc: 'Restyle room, living room, and cafe photos into new interior moods with AI.',
      keywords: 'AI interior simulator, room mood restyle, interior style generator, space redesign preview',
      heading: 'AI Interior Simulator',
      intro: 'Use this mode to explore home, cafe, or hotel-like interior atmosphere changes.',
      faqTitle: 'Interior FAQ',
      faq: [
        { q: 'Is this for room photos rather than portraits?', a: 'Yes. This mode is designed for interior and space images.' },
        { q: 'Can furniture layout also change?', a: 'Yes. The scene composition may shift along with the overall mood.' }
      ]
    }
  },
  {
    mode: 'animation',
    slug: 'animation',
    ko: {
      title: 'AI 애니메이션 생성기 | 사진을 캐릭터 스타일로 변환 | ManyTool',
      desc: '일반 사진을 애니메이션 캐릭터풍 이미지로 바꾸는 AI 애니메이션 생성기입니다.',
      keywords: 'AI 애니메이션 생성기, 사진 애니풍 변환, 캐릭터 스타일 이미지, 애니메이션 프로필',
      heading: 'AI 애니메이션 생성기',
      intro: '얼굴 인상은 살리면서 애니메이션 캐릭터 느낌으로 스타일링합니다.',
      faqTitle: '애니메이션 FAQ',
      faq: [
        { q: '일러스트 느낌으로 나오나요?', a: '네. 캐릭터풍 스타일로 변환하는 데 초점이 맞춰져 있습니다.' },
        { q: '프로필 이미지로 써도 되나요?', a: '네. SNS나 커뮤니티 프로필용으로 활용할 수 있습니다.' }
      ]
    },
    en: {
      title: 'AI Animation Generator | Photo to Character Style | ManyTool',
      desc: 'Turn a regular photo into an animation-inspired character image with AI.',
      keywords: 'AI animation generator, photo to character style, anime portrait generator, animated profile image',
      heading: 'AI Animation Generator',
      intro: 'This mode keeps core identity cues while applying an animation-inspired visual style.',
      faqTitle: 'Animation FAQ',
      faq: [
        { q: 'Does it look more like illustration?', a: 'Yes. It focuses on a stylized character-like result.' },
        { q: 'Can I use it as a profile image?', a: 'Yes. It works well for social and community profile use.' }
      ]
    }
  },
  {
    mode: 'free',
    slug: 'free-style',
    ko: {
      title: 'AI 자유 스타일 생성기 | 원하는 프롬프트로 사진 변환 | ManyTool',
      desc: '짧은 프롬프트를 직접 입력해 원하는 분위기로 사진을 바꾸는 AI 자유 스타일 생성기입니다.',
      keywords: 'AI 자유 스타일, 프롬프트 사진 변환, 커스텀 스타일 이미지, 맞춤형 AI 이미지',
      heading: 'AI 자유 스타일 생성기',
      intro: '특정 모드에 없는 스타일을 직접 텍스트로 지정하고 싶을 때 쓰는 커스텀 모드입니다.',
      faqTitle: '자유 스타일 FAQ',
      faq: [
        { q: '프롬프트는 길게 써야 하나요?', a: '짧고 핵심적인 스타일 설명만으로도 충분합니다.' },
        { q: '영어로 써도 되나요?', a: '네. 짧은 영어 스타일 문구도 활용 가능합니다.' }
      ]
    },
    en: {
      title: 'AI Free Style Generator | Custom Prompt Photo Editor | ManyTool',
      desc: 'Enter your own short prompt and transform a photo into a custom visual style with AI.',
      keywords: 'AI free style generator, custom prompt photo editor, custom style image AI, prompt-based photo restyle',
      heading: 'AI Free Style Generator',
      intro: 'Use this mode when you want a custom style that is not covered by the preset tabs.',
      faqTitle: 'Free Style FAQ',
      faq: [
        { q: 'Does the prompt need to be long?', a: 'No. A short, focused style prompt is usually enough.' },
        { q: 'Can I write the prompt in English?', a: 'Yes. Short English prompts work well too.' }
      ]
    }
  }
];

const buildEntries = (locale: Locale): SeoEntry[] =>
  SPECS.map((spec) => {
    const copy = spec[locale];
    return {
      slug: spec.slug,
      mode: spec.mode,
      title: copy.title,
      description: copy.desc,
      keywords: copy.keywords,
      heading: copy.heading,
      intro: copy.intro,
      faqTitle: copy.faqTitle,
      faq: copy.faq
    };
  });

const entryMap: Record<Locale, SeoEntry[]> = {
  ko: buildEntries('ko'),
  en: buildEntries('en')
};

export const getAiImageSeoEntries = (locale: Locale) => entryMap[locale];

export const getAiImageSeoPathEntries = () => [
  ...entryMap.ko.map((entry) => ({ path: `/ai-image-generator/${entry.slug}` })),
  ...entryMap.en.map((entry) => ({ path: `/en/ai-image-generator/${entry.slug}` }))
];
