export const MCP_AUTHORIZATION_METADATA_PATH =
  "/.well-known/oauth-authorization-server/api/auth";

const discoveryPaths = new Set([
  "/.well-known/oauth-protected-resource",
  "/.well-known/oauth-protected-resource/api/v1/mcp",
  MCP_AUTHORIZATION_METADATA_PATH,
]);

export function isMcpDiscoveryPath(path: string): boolean {
  return discoveryPaths.has(path.replace(/\/+$/, ""));
}
