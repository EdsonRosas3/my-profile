import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NoteRepository } from '@/lib/content/note.repository';
import { createContentProvider } from '@/lib/content/content-provider.factory';
import { markdownToHtml, extractTocFromHtml } from '@/lib/content/markdown.service';
import { TableOfContents, MobileToc } from './table-of-contents';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const repo = new NoteRepository(createContentProvider());
  const notes = await repo.findAll();
  return notes.map((note) => ({ slug: note.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const repo = new NoteRepository(createContentProvider());
  const note = await repo.findBySlug(slug);

  if (!note) return {};

  return {
    title: `${note.title} | Notas de Estudio`,
    description: note.description,
    openGraph: {
      title: note.title,
      description: note.description,
      type: 'article',
    },
  };
}

export default async function NotePage({ params }: Props) {
  const { slug } = await params;
  const repo = new NoteRepository(createContentProvider());
  const note = await repo.findBySlug(slug);

  if (!note) notFound();

  const html = await markdownToHtml(note.content);
  const toc = extractTocFromHtml(html);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-16">
        {/* Breadcrumb */}
        <Link
          href="/notes"
          className="mb-8 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← Notas de Estudio
        </Link>

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {note.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Layout: article + sidebar desktop */}
        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-16">
          <article
            className="prose prose-zinc dark:prose-invert max-w-none
              prose-headings:scroll-mt-24
              prose-table:block prose-table:overflow-x-auto
              prose-pre:bg-zinc-900 prose-pre:text-zinc-100"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {/* Desktop ToC — sticky sidebar, solo visible en lg+ */}
          {toc.length > 0 && (
            <aside className="hidden lg:block">
              <div className="sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <TableOfContents items={toc} />
              </div>
            </aside>
          )}
        </div>

        {/* Mobile ToC — FAB flotante, solo visible en pantallas < lg */}
        <div className="lg:hidden">
          <MobileToc items={toc} />
        </div>
      </div>
    </div>
  );
}
