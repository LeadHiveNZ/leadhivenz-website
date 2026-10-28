import Link from "next/link";

export function OfficeNav({ active }: { active: "board" | "week" | "invoices" }) {
  const tab = (key: typeof active, href: string, label: string, soon = false) => (
    <Link
      href={href}
      className={`flex h-12 items-center border-b-4 px-4 font-semibold ${active === key ? "border-accent text-primary" : "border-transparent text-muted"}`}
      aria-current={active === key ? "page" : undefined}
    >
      {label}
      {soon && <span className="ml-2 rounded bg-page px-1.5 text-xs">Phase 2</span>}
    </Link>
  );
  return (
    <nav className="sticky top-16 z-20 border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl overflow-x-auto px-1">
        {tab("board", "/office", "Board")}
        {tab("week", "/office/week", "Week & search")}
        {tab("invoices", "/office/invoices", "Invoices", true)}
      </div>
    </nav>
  );
}
