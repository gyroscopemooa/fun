// Snapshot of playable agents from valorant-api.com (ko-KR + en-US); used when the live fetch fails.
import type { GameCharacter } from './types';

export const VALORANT_FALLBACK: GameCharacter[] = [
  {"id": "41fb69c1-4189-7b37-f117-bcaf1e96f1bf", "name": "아스트라", "en": "Astra", "role": "controller", "icon": "https://media.valorant-api.com/agents/41fb69c1-4189-7b37-f117-bcaf1e96f1bf/displayicon.png", "color": "#26146c"},
  {"id": "9f0d8ba9-4140-b941-57d3-a7ad57c6b417", "name": "브림스톤", "en": "Brimstone", "role": "controller", "icon": "https://media.valorant-api.com/agents/9f0d8ba9-4140-b941-57d3-a7ad57c6b417/displayicon.png", "color": "#363c4f"},
  {"id": "1dbf2edd-4729-0984-3115-daa5eed44993", "name": "클로브", "en": "Clove", "role": "controller", "icon": "https://media.valorant-api.com/agents/1dbf2edd-4729-0984-3115-daa5eed44993/displayicon.png", "color": "#4b1d80"},
  {"id": "95b78ed7-4637-86d9-7e41-71ba8c293152", "name": "하버", "en": "Harbor", "role": "controller", "icon": "https://media.valorant-api.com/agents/95b78ed7-4637-86d9-7e41-71ba8c293152/displayicon.png", "color": "#275146"},
  {"id": "7c8a4701-4de6-9355-b254-e09bc2a34b72", "name": "믹스", "en": "Miks", "role": "controller", "icon": "https://media.valorant-api.com/agents/7c8a4701-4de6-9355-b254-e09bc2a34b72/displayicon.png", "color": "#462b75"},
  {"id": "8e253930-4c05-31dd-1b6c-968525494517", "name": "오멘", "en": "Omen", "role": "controller", "icon": "https://media.valorant-api.com/agents/8e253930-4c05-31dd-1b6c-968525494517/displayicon.png", "color": "#433178"},
  {"id": "707eab51-4836-f488-046a-cda6bf494859", "name": "바이퍼", "en": "Viper", "role": "controller", "icon": "https://media.valorant-api.com/agents/707eab51-4836-f488-046a-cda6bf494859/displayicon.png", "color": "#1a5f46"},
  {"id": "0e38b510-41a8-5780-5e8f-568b2a4f2d6c", "name": "아이소", "en": "Iso", "role": "duelist", "icon": "https://media.valorant-api.com/agents/0e38b510-41a8-5780-5e8f-568b2a4f2d6c/displayicon.png", "color": "#30336e"},
  {"id": "add6443a-41bd-e414-f6ad-e58d267f4e95", "name": "제트", "en": "Jett", "role": "duelist", "icon": "https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/displayicon.png", "color": "#25607a"},
  {"id": "bb2a4828-46eb-8cd1-e765-15848195d751", "name": "네온", "en": "Neon", "role": "duelist", "icon": "https://media.valorant-api.com/agents/bb2a4828-46eb-8cd1-e765-15848195d751/displayicon.png", "color": "#413476"},
  {"id": "eb93336a-449b-9c1b-0a54-a891f7921d69", "name": "피닉스", "en": "Phoenix", "role": "duelist", "icon": "https://media.valorant-api.com/agents/eb93336a-449b-9c1b-0a54-a891f7921d69/displayicon.png", "color": "#74321c"},
  {"id": "f94c3b30-42be-e959-889c-5aa313dba261", "name": "레이즈", "en": "Raze", "role": "duelist", "icon": "https://media.valorant-api.com/agents/f94c3b30-42be-e959-889c-5aa313dba261/displayicon.png", "color": "#742e1e"},
  {"id": "a3bfb853-43b2-7238-a4f1-ad90e9e46bcc", "name": "레이나", "en": "Reyna", "role": "duelist", "icon": "https://media.valorant-api.com/agents/a3bfb853-43b2-7238-a4f1-ad90e9e46bcc/displayicon.png", "color": "#662d62"},
  {"id": "df1cb487-4902-002e-5c17-d28e83e78588", "name": "웨이레이", "en": "Waylay", "role": "duelist", "icon": "https://media.valorant-api.com/agents/df1cb487-4902-002e-5c17-d28e83e78588/displayicon.png", "color": "#482e61"},
  {"id": "7f94d92c-4234-0a36-9646-3a87eb8b5c89", "name": "요루", "en": "Yoru", "role": "duelist", "icon": "https://media.valorant-api.com/agents/7f94d92c-4234-0a36-9646-3a87eb8b5c89/displayicon.png", "color": "#222b67"},
  {"id": "5f8d3a7f-467b-97f3-062c-13acf203c006", "name": "브리치", "en": "Breach", "role": "initiator", "icon": "https://media.valorant-api.com/agents/5f8d3a7f-467b-97f3-062c-13acf203c006/displayicon.png", "color": "#81331a"},
  {"id": "dade69b4-4f5a-8528-247b-219e5a1facd6", "name": "페이드", "en": "Fade", "role": "initiator", "icon": "https://media.valorant-api.com/agents/dade69b4-4f5a-8528-247b-219e5a1facd6/displayicon.png", "color": "#1d2846"},
  {"id": "e370fa57-4757-3604-3648-499e1f642d3f", "name": "게코", "en": "Gekko", "role": "initiator", "icon": "https://media.valorant-api.com/agents/e370fa57-4757-3604-3648-499e1f642d3f/displayicon.png", "color": "#371c5c"},
  {"id": "601dbbe7-43ce-be57-2a40-4abd24953621", "name": "케이/오", "en": "KAY/O", "role": "initiator", "icon": "https://media.valorant-api.com/agents/601dbbe7-43ce-be57-2a40-4abd24953621/displayicon.png", "color": "#1c2a69"},
  {"id": "6f2a04ca-43e0-be17-7f36-b3908627744d", "name": "스카이", "en": "Skye", "role": "initiator", "icon": "https://media.valorant-api.com/agents/6f2a04ca-43e0-be17-7f36-b3908627744d/displayicon.png", "color": "#436a51"},
  {"id": "320b2a48-4d9b-a075-30f1-1f93a9b638fa", "name": "소바", "en": "Sova", "role": "initiator", "icon": "https://media.valorant-api.com/agents/320b2a48-4d9b-a075-30f1-1f93a9b638fa/displayicon.png", "color": "#355285"},
  {"id": "b444168c-4e35-8076-db47-ef9bf368f384", "name": "테호", "en": "Tejo", "role": "initiator", "icon": "https://media.valorant-api.com/agents/b444168c-4e35-8076-db47-ef9bf368f384/displayicon.png", "color": "#80451b"},
  {"id": "22697a3d-45bf-8dd7-4fec-84a9e28c69d7", "name": "체임버", "en": "Chamber", "role": "sentinel", "icon": "https://media.valorant-api.com/agents/22697a3d-45bf-8dd7-4fec-84a9e28c69d7/displayicon.png", "color": "#20435b"},
  {"id": "117ed9e3-49f3-6512-3ccf-0cada7e3823b", "name": "사이퍼", "en": "Cypher", "role": "sentinel", "icon": "https://media.valorant-api.com/agents/117ed9e3-49f3-6512-3ccf-0cada7e3823b/displayicon.png", "color": "#2f5078"},
  {"id": "cc8b64c8-4b25-4ff9-6e7f-37b4da43d235", "name": "데드록", "en": "Deadlock", "role": "sentinel", "icon": "https://media.valorant-api.com/agents/cc8b64c8-4b25-4ff9-6e7f-37b4da43d235/displayicon.png", "color": "#425495"},
  {"id": "1e58de9c-4950-5125-93e9-a0aee9f98746", "name": "킬조이", "en": "Killjoy", "role": "sentinel", "icon": "https://media.valorant-api.com/agents/1e58de9c-4950-5125-93e9-a0aee9f98746/displayicon.png", "color": "#522162"},
  {"id": "569fdd95-4d10-43ab-ca70-79becc718b46", "name": "세이지", "en": "Sage", "role": "sentinel", "icon": "https://media.valorant-api.com/agents/569fdd95-4d10-43ab-ca70-79becc718b46/displayicon.png", "color": "#1f5148"},
  {"id": "92eeef5d-43b5-1d4a-8d03-b3927a09034b", "name": "비토", "en": "Veto", "role": "sentinel", "icon": "https://media.valorant-api.com/agents/92eeef5d-43b5-1d4a-8d03-b3927a09034b/displayicon.png", "color": "#1a5d65"},
  {"id": "efba5359-4016-a1e5-7626-b1ae76895940", "name": "바이스", "en": "Vyse", "role": "sentinel", "icon": "https://media.valorant-api.com/agents/efba5359-4016-a1e5-7626-b1ae76895940/displayicon.png", "color": "#492280"}
];
