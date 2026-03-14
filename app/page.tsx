import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <main className="flex flex-col items-center gap-8 text-center sm:items-start sm:text-left max-w-2xl w-full py-24">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Edson Rosas
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400">
            Java Senior Developer — preparando entrevistas técnicas
          </p>
        </div>

        <p className="text-zinc-600 dark:text-zinc-400 leading-7 max-w-lg">
          Aquí comparto mis notas de estudio sobre Java, Spring Boot y arquitectura de software,
          orientadas a entrevistas para posiciones senior.
        </p>

        <Link
          href="/notes"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Ver notas de estudio →
        </Link>
      </main>
    </div>
  );
}