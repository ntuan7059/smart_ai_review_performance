import React from "react";

// Deliberately minimal — just enough of GitHub-flavored Markdown to render the
// AI Review's structured output (headings, bold, bullet/numbered lists, paragraphs)
// as an actual document instead of a wall of raw "##"/"**" text.
function renderInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>;
  });
}

export default function Markdown({ text }) {
  const lines = (text || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let listBuffer = null; // { type: "ul" | "ol", items: string[] }
  let paraBuffer = [];

  function flushList() {
    if (!listBuffer) return;
    const Tag = listBuffer.type;
    blocks.push(
      <Tag key={`list-${blocks.length}`} className="compact-list">
        {listBuffer.items.map((item, i) => (
          <li key={i}>{renderInline(item, `li-${blocks.length}-${i}`)}</li>
        ))}
      </Tag>
    );
    listBuffer = null;
  }

  function flushPara() {
    if (!paraBuffer.length) return;
    const text = paraBuffer.join(" ");
    blocks.push(<p key={`p-${blocks.length}`}>{renderInline(text, `p-${blocks.length}`)}</p>);
    paraBuffer = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushPara();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushPara();
      flushList();
      const level = heading[1].length;
      const HeadingTag = `h${Math.min(level + 1, 6)}`; // page already has an <h2>, so start at h3
      blocks.push(<HeadingTag key={`h-${blocks.length}`}>{renderInline(heading[2], `h-${blocks.length}`)}</HeadingTag>);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      flushPara();
      if (!listBuffer || listBuffer.type !== "ul") {
        flushList();
        listBuffer = { type: "ul", items: [] };
      }
      listBuffer.items.push(bullet[1]);
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushPara();
      if (!listBuffer || listBuffer.type !== "ol") {
        flushList();
        listBuffer = { type: "ol", items: [] };
      }
      listBuffer.items.push(numbered[1]);
      continue;
    }

    flushList();
    paraBuffer.push(line);
  }
  flushPara();
  flushList();

  return <div className="markdown-doc">{blocks}</div>;
}
