import React from "react";

const TONES = {
  linked: "badge-green",
  unlinked: "badge-gray",
  ambiguous: "badge-orange",
  OPEN: "badge-blue",
  MERGED: "badge-green",
  DECLINED: "badge-red",
  SUPERSEDED: "badge-gray",
  Done: "badge-green",
  Closed: "badge-green",
  Resolved: "badge-green",
};

export default function StatusBadge({ value, tone }) {
  const cls = tone || TONES[value] || "badge-gray";
  return <span className={`badge ${cls}`}>{value}</span>;
}
