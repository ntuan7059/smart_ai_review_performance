export function identitiesOf({ author, authorUsername } = {}) {
  return [
    ...new Set(
      [author, authorUsername]
        .filter((s) => typeof s === "string" && s.trim())
        .map((s) => s.trim().toLowerCase())
    ),
  ];
}

/** True if the record and the selected person share any display name or username. */
export function matchesAuthor(record, author, authorUsername) {
  const needles = identitiesOf({ author, authorUsername });
  if (!needles.length) return true;
  const hay = identitiesOf({ author: record.author, authorUsername: record.authorUsername });
  return needles.some((n) => hay.includes(n));
}

export function authorLabel({ author, authorUsername } = {}) {
  if (author && authorUsername && author !== authorUsername) return `${author} (${authorUsername})`;
  return author || authorUsername || "";
}
