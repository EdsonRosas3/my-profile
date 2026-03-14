'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Note } from '@/lib/content/providers/content-provider.interface';

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/#{1,6}\s+/g, ' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[-*+]\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMatchExcerpt(content: string, query: string): string {
  const plain = stripMarkdown(content);
  const idx = plain.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return '';
  const start = Math.max(0, idx - 60);
  const end = Math.min(plain.length, idx + query.length + 60);
  const excerpt = plain.slice(start, end);
  return (start > 0 ? '…' : '') + excerpt + (end < plain.length ? '…' : '');
}

interface Props {
  notes: Note[];
}

export default function NotesSearch({ notes }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;

    return notes.filter((note) => {
      const inTitle = note.title.toLowerCase().includes(q);
      const inDescription = note.description?.toLowerCase().includes(q) ?? false;
      const inTags = note.tags?.some((t) => t.toLowerCase().includes(q)) ?? false;
      const inContent = stripMarkdown(note.content).toLowerCase().includes(q);
      return inTitle || inDescription || inTags || inContent;
    });
  }, [query, notes]);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en las notas…"
          className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 pl-10 text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
        />
        <svg
          className="absolute left-3 top-3.5 h-4 w-4 text-zinc-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
      </div>

      {query.trim() && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {filtered.length === 0
            ? 'Sin resultados para "'+ query +'"'
            : `${filtered.length} nota${filtered.length > 1 ? 's' : ''} encontrada${filtered.length > 1 ? 's' : ''}`}
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {filtered.map((note) => {
          const excerpt = query.trim() ? getMatchExcerpt(note.content, query.trim()) : null;
          return (
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
                {excerpt && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-3 font-mono leading-5">
                    {excerpt}
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
          );
        })}
      </ul>
    </div>
  );
}
