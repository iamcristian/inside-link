export interface LinkCursor {
  p: 0 | 1;
  id: string;
}

const ULID_REGEX = /^[0-9A-HJ-KM-NP-TV-Z]{26}$/i;

export function encodeLinkCursor(cursor: LinkCursor): string {
  const json = JSON.stringify({ p: cursor.p, id: cursor.id });
  return Buffer.from(json, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeLinkCursor(cursorStr: string | null | undefined): LinkCursor | null {
  if (!cursorStr || typeof cursorStr !== "string") {
    return null;
  }

  try {
    // Restaurar base64 estándar desde base64url
    let base64 = cursorStr.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }

    const decoded = Buffer.from(base64, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded) as Record<string, unknown>;

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed["p"] === 0 || parsed["p"] === 1) &&
      typeof parsed["id"] === "string" &&
      ULID_REGEX.test(parsed["id"])
    ) {
      return {
        p: parsed["p"] as 0 | 1,
        id: parsed["id"].toUpperCase(),
      };
    }

    return null;
  } catch {
    return null;
  }
}
