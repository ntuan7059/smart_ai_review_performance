/**
 * Minimal Atlassian Document Format (ADF) -> plain text renderer.
 * Good enough for displaying Jira descriptions/comments as readable text;
 * not a full ADF renderer (no tables/media/panels formatting beyond text).
 */
export function adfToPlainText(doc) {
  if (!doc) return "";
  if (typeof doc === "string") return doc;

  const lines = [];
  let current = "";

  function flush() {
    if (current.length > 0) {
      lines.push(current);
      current = "";
    }
  }

  function visit(node) {
    if (!node) return;
    switch (node.type) {
      case "text":
        current += node.text || "";
        break;
      case "hardBreak":
        current += "\n";
        break;
      case "paragraph":
      case "heading":
        (node.content || []).forEach(visit);
        flush();
        break;
      case "bulletList":
      case "orderedList":
        (node.content || []).forEach((item, idx) => {
          const prefix = node.type === "orderedList" ? `${idx + 1}. ` : "- ";
          current += prefix;
          (item.content || []).forEach(visit);
          flush();
        });
        break;
      case "codeBlock": {
        const text = (node.content || []).map((c) => c.text || "").join("");
        lines.push(text);
        break;
      }
      default:
        (node.content || []).forEach(visit);
    }
  }

  (doc.content || []).forEach(visit);
  flush();

  return lines.join("\n").trim();
}
