import { getCollection, type CollectionEntry } from 'astro:content';

export const communityPosts = async () => (await getCollection('community', ({ data }) => !data.draft))
  .sort((a, b) => b.data.published.localeCompare(a.data.published) || a.id.localeCompare(b.id));

export const relatedPosts = (post: CollectionEntry<'community'>, posts: CollectionEntry<'community'>[]) =>
  posts.filter((other) => other.id !== post.id && other.data.tags.some((tag) => post.data.tags.includes(tag))).slice(0, 3);
