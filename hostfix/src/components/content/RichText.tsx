import Link from "next/link";
import type { ReactNode } from "react";
import type { Block, Inline } from "@/lib/content";

/** Draws the pieces of landing page copy produced by src/lib/content.ts. */

export function InlineText({ nodes }: { nodes: Inline[] }): ReactNode {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return node.text;
      case "edit":
        return (
          <mark key={index} className="rounded bg-yellow-200 px-1 text-ink" data-edit-marker>
            {node.text}
          </mark>
        );
      case "strong":
        return (
          <strong key={index} className="font-semibold text-ink">
            <InlineText nodes={node.children} />
          </strong>
        );
      case "em":
        return (
          <em key={index}>
            <InlineText nodes={node.children} />
          </em>
        );
      case "link": {
        const className = "font-medium text-brand underline underline-offset-2 hover:text-brand-dark";
        return node.href.startsWith("/") ? (
          <Link key={index} href={node.href} className={className}>
            <InlineText nodes={node.children} />
          </Link>
        ) : (
          <a key={index} href={node.href} className={className}>
            <InlineText nodes={node.children} />
          </a>
        );
      }
      case "break":
        return <br key={index} />;
    }
  });
}

function Tick() {
  return (
    <svg viewBox="0 0 20 20" className="mt-1 h-5 w-5 shrink-0 text-brand" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.12" />
      <path d="m6 10.4 2.6 2.6L14 7.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "paragraph":
      return (
        <p>
          <InlineText nodes={block.children} />
        </p>
      );
    case "list":
      if (block.ordered) {
        return (
          <ol className="space-y-5">
            {block.items.map((item, index) => (
              <li key={index} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-base font-semibold text-white"
                >
                  {index + 1}
                </span>
                <span className="pt-1">
                  <InlineText nodes={item} />
                </span>
              </li>
            ))}
          </ol>
        );
      }
      return (
        <ul className="space-y-3">
          {block.items.map((item, index) => (
            <li key={index} className="flex gap-3">
              <Tick />
              <span>
                <InlineText nodes={item} />
              </span>
            </li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote className="rounded-2xl border-l-4 border-brand bg-tint px-5 py-5 text-lg font-medium text-ink sm:px-6">
          {block.paragraphs.map((paragraph, index) => (
            <p key={index} className={index > 0 ? "mt-3" : undefined}>
              <InlineText nodes={paragraph} />
            </p>
          ))}
        </blockquote>
      );
    case "card":
      return (
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
          <h3 className="text-lg font-semibold text-ink">
            <InlineText nodes={block.title} />
          </h3>
          <div className="mt-2 space-y-3 text-muted">
            <Blocks blocks={block.blocks} />
          </div>
        </div>
      );
  }
}

/** Cards that sit next to each other are laid out side by side on wider screens. */
export function Blocks({ blocks }: { blocks: Block[] }) {
  const groups: (Block | Block[])[] = [];
  for (const block of blocks) {
    const last = groups[groups.length - 1];
    if (block.type === "card" && Array.isArray(last)) last.push(block);
    else if (block.type === "card") groups.push([block]);
    else groups.push(block);
  }
  return groups.map((group, index) =>
    Array.isArray(group) ? (
      <div key={index} className={`grid gap-4 ${group.length > 1 ? "md:grid-cols-2" : ""}`}>
        {group.map((card, cardIndex) => (
          <BlockView key={cardIndex} block={card} />
        ))}
      </div>
    ) : (
      <BlockView key={index} block={group} />
    ),
  );
}
