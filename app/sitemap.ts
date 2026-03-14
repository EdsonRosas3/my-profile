import type { MetadataRoute } from 'next';
import { NoteRepository } from '@/lib/content/note.repository';
import { createContentProvider } from '@/lib/content/content-provider.factory';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://my-profile.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const repo = new NoteRepository(createContentProvider());
  const notes = await repo.findAll();

  const noteEntries = notes.map((note) => ({
    url: `${BASE_URL}/notes/${note.slug}`,
    lastModified: note.date ? new Date(note.date) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  return [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
    { url: `${BASE_URL}/notes`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    ...noteEntries,
  ];
}
