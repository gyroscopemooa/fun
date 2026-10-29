import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const localPath = z.string().regex(/^\/[a-z0-9/-]+$/, '사이트 내부 경로를 입력하세요.');
const community = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/community' }),
  schema: z.object({
    title: z.string().min(5),
    description: z.string().min(10),
    question: z.string().min(5),
    category: z.enum(['사진·이미지', '문서·텍스트', '생활 도구', '게임·테스트', '이용 안내']),
    published: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    tags: z.array(z.string().min(1)).min(1),
    tools: z.array(z.object({ href: localPath, label: z.string().min(2) })).default([]),
    draft: z.boolean().default(true),
  }),
});
export const collections = { community };
