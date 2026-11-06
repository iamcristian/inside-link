const discoveryPaths = new Set([
  "/.well-known/oauth-protected-resource",
  "/.well-known/oauth-protected-resource/api/v1/mcp",
  "/.well-known/oauth-authorization-server/api/auth",
]);

export function isMcpDiscoveryPath(path: string): boolean {
  return discoveryPaths.has(path.replace(/\/+$/, ""));
}
