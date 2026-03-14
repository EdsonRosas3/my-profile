import type { ContentProvider, Note, NoteMetadata } from './providers/content-provider.interface';

export class NoteRepository {
  constructor(private readonly provider: ContentProvider) {}

  findAll(): Promise<NoteMetadata[]> {
    return this.provider.getAllNotes();
  }

  findBySlug(slug: string): Promise<Note | null> {
    return this.provider.getNoteBySlug(slug);
  }
}
