import {
  ApiRequestInputSchema,
  ApiRequestSchema,
  getConfig,
  type ApiConfig,
  type ApiRequest,
  type FirewallRule,
  type RouteFirewall
} from "../configuration/config";

import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ToolDefinition } from "../types";
import { decryptAuthorization } from "../configuration/secrets";

const BLOCKED_HEADERS = [
  "authorization",
  "cookie",
  "x-api-key",
  "x-auth-token"
];

// --- Request helpers ---

function mergeAndCleanHeaders(
  configHeaders: Headers,
  toolHeaders: Headers,
  extraBlocked: string[] = []
): Headers {
  // Headers retrieved from the MCP server request
  const merged = new Headers(toolHeaders);

  // compile all blocked headers
  const blockedHeaders = [
    ...BLOCKED_HEADERS,
    ...extraBlocked
  ]
   // remove blocked headers
  blockedHeaders.forEach(h => merged.delete(h));

  // Add my config headers in after the fact
  configHeaders.forEach((val, key) => merged.set(key, val));

  // done :)
  return merged;
}

const validateRoute = (
  firewall: RouteFirewall,
  method: string,
  endpoint: string,
) => {
  const requestMatchesRule = (rule: FirewallRule) =>
    rule.methods.includes(method as any) && rule.api_endpoint_matchers.some((p: RegExp) => p.test(endpoint));

  // keeps track of any errors
  const errors: string[] = []

  // validation
  const routeIsDenied = firewall.deny.some(requestMatchesRule);
  if (routeIsDenied) errors.push("Request explicitly denied");

  const routeIsAllowed = firewall.allow.some(requestMatchesRule);
  if (!routeIsAllowed) errors.push("That combination of method and url is not allowed");

  // done :)
  const isValid = errors.length === 0;
  return { isValid, errors }
}

const buildRequestOpts = async(
  apiEntry: ApiConfig,
  request: ApiRequest
): Promise<{ requestInit: RequestInit, sensitiveValues: string[] }> => {
  const {
    authorization,
    blocked_headers
  } = apiEntry;

  const {
    body: requestbody,
    method,
    headers: requestHeaders
  } = request;

  const auth = await decryptAuthorization(authorization)
  const headers = mergeAndCleanHeaders(
    auth.headers ?? new Headers(),
    requestHeaders ?? new Headers(),
    blocked_headers
  );

  // collect decrypted auth header values so they can be scrubbed from responses
  const sensitiveValues: string[] = [];
  auth.headers?.forEach((val) => sensitiveValues.push(val));

  const body: BodyInit | undefined = (requestbody !== undefined && !['GET', 'HEAD'].includes(method))
    ? JSON.stringify(requestbody)
    : undefined

  return { requestInit: { method, headers, body }, sensitiveValues };
}

// --- Response helpers ---

function filterFields(value: unknown, denyFields: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) {
    return value.map(item => filterFields(item, denyFields));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (denyFields.has(key)) continue;
      result[key] = filterFields(val, denyFields);
    }
    return result;
  }
  return value;
}

function applyFieldFilters(rawText: string, denyFields: string[]): string {
  if (denyFields.length === 0) return rawText;
  try {
    const parsed = JSON.parse(rawText);
    return JSON.stringify(filterFields(parsed, new Set(denyFields)));
  } catch {
    return rawText;
  }
}

function buildScrubber(
  backendUrl: string,
  sensitiveValues: string[],
  patterns: RegExp[]
): (s: string) => string {
  const scrubPatterns: (string | RegExp)[] = [backendUrl, ...sensitiveValues, ...patterns];
  return (s: string) => scrubPatterns.reduce<string>((t, p) =>
    typeof p === 'string' ? t.replaceAll(p, '[REDACTED]') : t.replace(p, '[REDACTED]'), s);
}

// --- Tool definition ---

const toolDefinition: ToolDefinition = {
  name: "fetch",
  config: {
    description: "Make a request to an endpoint",
    inputSchema: ApiRequestInputSchema,
  },
  function: async (args: unknown, _: RequestHandlerExtra<any, any>): Promise<any> => {
    const apiRequest = ApiRequestSchema.parse(args);
    const { mcp_route, method, endpoint, params } = apiRequest;

    // This checks for injection of urls literally like: '/api2/json/../../../var/lib'
    if (/(\.\.|\/\/|\\)/.test(endpoint)) throw new Error("Invalid endpoint");

    // See if this route exists in our config
    const apiEntry = getConfig().apis[mcp_route];
    if (!apiEntry) throw new Error(`No API configured for route: ${mcp_route}`);

    // Validate that the route and method is allowed
    const { isValid, errors } = validateRoute(apiEntry.routes, method, endpoint);
    if (!isValid) throw new Error(`Request failed: ${errors.join(", ")}`);

    // Build request
    const url = `${apiEntry.api_server_url}${endpoint}${params ? '?' + params.toString() : ''}`;
    const { requestInit, sensitiveValues } = await buildRequestOpts(apiEntry, apiRequest);
    const scrub = buildScrubber(apiEntry.api_server_url, sensitiveValues, apiEntry.scrub_response);

    // Send request — catch network-level errors to avoid leaking the backend URL
    let response: Response;
    try {
      response = await fetch(url, requestInit);
    } catch {
      throw new Error(`${mcp_route}${endpoint} request failed`);
    }

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`${mcp_route}${endpoint} returned ${response.status}: ${scrub(rawText).slice(0, 200)}`);
    }

    // Apply field filters first (structural), then scrub remaining sensitive patterns (textual)
    const filtered = applyFieldFilters(rawText, apiEntry.deny_fields);
    const text = scrub(filtered);

    return { content: [{ type: "text", text }] };
  }
}

export default toolDefinition;
