import type { Metadata } from 'next';
import Link from 'next/link';
import { NoteRepository } from '@/lib/content/note.repository';
import { createContentProvider } from '@/lib/content/content-provider.factory';
import NotesSearch from './notes-search';

export const metadata: Metadata = {
  title: 'Notas de Estudio | Java & Spring Boot Senior',
  description: 'Guías completas de Java y Spring Boot para preparar entrevistas senior.',
};

export default async function NotesPage() {
  const repo = new NoteRepository(createContentProvider());
  const notes = await repo.findAllWithContent();

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-16">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← Volver al inicio
        </Link>

        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">
          Notas de Estudio
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mb-10">
          Java y Spring Boot — preparación para entrevistas senior
        </p>

        <NotesSearch notes={notes} />
      </div>
    </main>
  );
}
