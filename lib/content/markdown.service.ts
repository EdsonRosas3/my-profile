import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';

export interface TocItem {
  id: string;
  text: string;
  depth: number;
}

export async function markdownToHtml(markdown: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeHighlight)
    .use(rehypeStringify)
    .process(markdown);

  return result.toString();
}

/**
 * Extrae los headings del HTML ya renderizado.
 * Lee los mismos IDs que generó rehype-slug, garantizando que los
 * enlaces del ToC apunten a los elementos correctos.
 */
export function extractTocFromHtml(html: string, maxDepth = 3): TocItem[] {
  const toc: TocItem[] = [];
  const depthRange = Array.from({ length: maxDepth }, (_, i) => i + 1).join('');
  const regex = new RegExp(
    `<h([${depthRange}])[^>]*\\sid="([^"]+)"[^>]*>(.*?)<\\/h[${depthRange}]>`,
    'gi',
  );

  let match;
  while ((match = regex.exec(html)) !== null) {
    const depth = parseInt(match[1], 10);
    const id = match[2];
    const text = match[3].replace(/<[^>]+>/g, '').trim();
    // Saltar h1 — es el título principal ya visible en la página
    if (depth > 1) {
      toc.push({ id, text, depth });
    }
  }

  return toc;
}
