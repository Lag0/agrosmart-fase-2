import type { ReactNode } from "react";

/**
 * Renderiza a saída do modelo.
 *
 * O prompt fixa o formato — títulos `##`, lista numerada, bullets `*` e
 * ênfase `**` — então um renderizador dedicado a esse subconjunto evita
 * trazer uma dependência de markdown para exibir três marcações.
 */
export function RecommendationContent({ content }: { content: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {parseBlocks(content)}
    </div>
  );
}

function parseBlocks(content: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  function flushList() {
    if (listItems.length === 0) return;
    const items = listItems.map((item, index) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: lista estática, sem reordenação
      <li key={index} className="ml-4">
        {renderInline(item)}
      </li>
    ));
    blocks.push(
      listOrdered ? (
        <ol
          key={`list-${blocks.length}`}
          className="list-decimal space-y-1.5 pl-2"
        >
          {items}
        </ol>
      ) : (
        <ul
          key={`list-${blocks.length}`}
          className="list-disc space-y-1.5 pl-2"
        >
          {items}
        </ul>
      ),
    );
    listItems = [];
  }

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    if (line === "") {
      flushList();
      continue;
    }

    const heading = line.match(/^#{2,3}\s+(.*)$/);
    if (heading) {
      flushList();
      blocks.push(
        <h3
          key={`h-${blocks.length}`}
          className="text-foreground pt-1 font-semibold"
        >
          {heading[1]}
        </h3>,
      );
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.*)$/);
    if (ordered) {
      if (!listOrdered) flushList();
      listOrdered = true;
      listItems.push(ordered[1]);
      continue;
    }

    const bullet = line.match(/^[*-]\s+(.*)$/);
    if (bullet) {
      if (listOrdered) flushList();
      listOrdered = false;
      listItems.push(bullet[1]);
      continue;
    }

    flushList();
    blocks.push(<p key={`p-${blocks.length}`}>{renderInline(line)}</p>);
  }

  flushList();
  return blocks;
}

/** Converte `**texto**` em negrito, preservando o resto como está. */
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: segmentos de uma linha estática
        <strong key={index} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    // biome-ignore lint/suspicious/noArrayIndexKey: segmentos de uma linha estática
    return <span key={index}>{part}</span>;
  });
}
