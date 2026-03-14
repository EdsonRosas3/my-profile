import type { ContentProvider } from './providers/content-provider.interface';
import { LocalFileProvider } from './providers/local-file.provider';

export function createContentProvider(): ContentProvider {
  const source = process.env.CONTENT_SOURCE ?? 'local';

  switch (source) {
    case 'local':
    default:
      return new LocalFileProvider();
    // case 's3':
    //   return new S3Provider();
    // case 'database':
    //   return new DatabaseProvider();
  }
}
