// Record identifiers keep a readable width instead of collapsing to one glyph.
export function tableColumnClass(key: string) {
  const name = key.replaceAll("_", "").toLowerCase();
  if (
    name === "id" ||
    name === "uid" ||
    name.endsWith("id") ||
    name.endsWith("uid") ||
    name.includes("reference")
  )
    return "min-w-56 max-w-72";
  if (
    /(createdat|updatedat|occurredat|submittedat|reviewedat|firstorderat)/.test(
      name,
    )
  )
    return "min-w-44 max-w-56";
  if (
    /(email|name|address|reason|narration|message|unavailablefields)/.test(name)
  )
    return "min-w-48 max-w-80";
  return "min-w-32 max-w-72";
}
