import Link from "next/link";
import { Wordmark } from "./Wordmark";

export function TopBar({
  title,
  back,
  right,
  home = "/",
}: {
  title?: string;
  back?: string;
  right?: React.ReactNode;
  home?: string;
}) {
  return (
    <header className="sticky top-0 z-30 bg-primary text-white" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-3">
        {back ? (
          <Link href={back} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl" aria-label="Back">
            ‹
          </Link>
        ) : (
          <Link href={home} className="flex h-12 shrink-0 items-center" aria-label="Home">
            <Wordmark size="sm" light />
          </Link>
        )}
        {title && <h1 className="min-w-0 flex-1 truncate text-2xl leading-none">{title}</h1>}
        {!title && <div className="flex-1" />}
        {right}
      </div>
    </header>
  );
}
