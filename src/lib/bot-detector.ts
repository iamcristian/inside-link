const SOCIAL_BOT_PATTERNS = [
  /whatsapp/i,
  /facebookexternalhit/i,
  /facebot/i,
  /twitterbot/i,
  /linkedinbot/i,
  /discordbot/i,
  /slackbot/i,
  /telegrambot/i,
  /pinterest/i,
  /skypeuripreview/i,
  /vkshare/i,
  /redditbot/i,
  /applebot/i,
];

export function isSocialPreviewBot(userAgent: string | null | undefined): boolean {
  if (!userAgent || typeof userAgent !== "string") {
    return false;
  }
  return SOCIAL_BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

export function isPrefetchRequest(
  headers: Headers | Record<string, string | string[] | undefined>
): boolean {
  const getHeader = (name: string): string | null => {
    if (typeof (headers as Headers).get === "function") {
      return (headers as Headers).get(name);
    }
    const val = (headers as Record<string, string | string[] | undefined>)[name.toLowerCase()];
    if (Array.isArray(val)) return val[0] || null;
    return val || null;
  };

  const purpose = getHeader("purpose") || getHeader("sec-purpose") || getHeader("x-purpose");
  if (purpose && (purpose.toLowerCase() === "prefetch" || purpose.toLowerCase() === "preview")) {
    return true;
  }

  const nextPrefetch = getHeader("next-router-prefetch");
  if (nextPrefetch === "1") {
    return true;
  }

  const mozPrefetch = getHeader("x-moz");
  if (mozPrefetch && mozPrefetch.toLowerCase() === "prefetch") {
    return true;
  }

  return false;
}
