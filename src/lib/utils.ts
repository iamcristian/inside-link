export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(" ");
}

export function formatShortDate(isoString: string | null | undefined): string {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return "";
  }
}
