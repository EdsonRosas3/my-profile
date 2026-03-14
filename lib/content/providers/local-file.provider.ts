import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { ContentProvider, Note, NoteMetadata } from './content-provider.interface';

const NOTES_DIR = path.join(process.cwd(), 'content', 'notes');

export class LocalFileProvider implements ContentProvider {
  async getAllNotes(): Promise<NoteMetadata[]> {
    const files = fs.readdirSync(NOTES_DIR).filter((f) => f.endsWith('.md'));

    return files.map((filename) => {
      const raw = fs.readFileSync(path.join(NOTES_DIR, filename), 'utf-8');
      const { data } = matter(raw);
      const slug = filename.replace(/\.md$/, '');

      return {
        slug,
        title: (data.title as string) ?? slug,
        description: data.description as string | undefined,
        tags: data.tags as string[] | undefined,
        date: data.date as string | undefined,
      };
    });
  }

  async getNoteBySlug(slug: string): Promise<Note | null> {
    const filePath = path.join(NOTES_DIR, `${slug}.md`);

    if (!fs.existsSync(filePath)) return null;

    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);

    return {
      slug,
      title: (data.title as string) ?? slug,
      description: data.description as string | undefined,
      tags: data.tags as string[] | undefined,
      date: data.date as string | undefined,
      content,
    };
  }
}
