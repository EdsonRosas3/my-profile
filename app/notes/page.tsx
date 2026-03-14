import type { Metadata } from 'next';
import Link from 'next/link';
import { NoteRepository } from '@/lib/content/note.repository';
import { createContentProvider } from '@/lib/content/content-provider.factory';

export const metadata: Metadata = {
  title: 'Notas de Estudio | Java & Spring Boot Senior',
  description: 'Guías completas de Java y Spring Boot para preparar entrevistas senior.',
};

export default async function NotesPage() {
  const repo = new NoteRepository(createContentProvider());
  const notes = await repo.findAll();

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

        <ul className="flex flex-col gap-4">
          {notes.map((note) => (
            <li key={note.slug}>
              <Link
                href={`/notes/${note.slug}`}
                className="block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
              >
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
                  {note.title}
                </h2>
                {note.description && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                    {note.description}
                  </p>
                )}
                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {note.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
