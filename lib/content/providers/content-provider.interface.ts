export interface NoteMetadata {
  slug: string;
  title: string;
  description?: string;
  tags?: string[];
  date?: string;
}

export interface Note extends NoteMetadata {
  content: string;
}

export interface ContentProvider {
  getAllNotes(): Promise<NoteMetadata[]>;
  getNoteBySlug(slug: string): Promise<Note | null>;
}
