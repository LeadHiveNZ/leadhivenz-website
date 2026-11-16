import type { PriceList } from "@/lib/leads/price-list";
import { formatMoney } from "@/lib/money";

/** The full price list, in groups, with what else can be charged underneath. */
export function PriceListTable({ list, currency, notes }: { list: PriceList; currency: string; notes: string[] }) {
  return (
    <div>
      <div className="space-y-6">
        {list.groups.map((group) => (
          <section key={group.group} aria-label={group.group}>
            <h3 className="text-sm font-bold tracking-wide text-muted uppercase">{group.group}</h3>
            <ul className="mt-1.5">
              {group.items.map((item) => (
                <li key={item.code} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-base">
                  <span className="text-ink">{item.name}</span>
                  <span className="tabular shrink-0 font-bold text-ink">{formatMoney(item.ownerPriceCents, currency)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <ul className="mt-5 space-y-2 text-sm text-muted">
        {notes.map((note) => (
          <li key={note} className="flex gap-2">
            <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand/50" />
            {note}
          </li>
        ))}
      </ul>
    </div>
  );
}
