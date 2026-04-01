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
): Promise<RequestInit> => {
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

  const body: BodyInit | undefined = (requestbody !== undefined && !['GET', 'HEAD'].includes(method))
    ? JSON.stringify(requestbody)
    : undefined

  return { method, headers, body };
}

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
    if(!isValid) throw new Error(`Request failed: ${errors.join(", ")}`)

    // build & send request
    const url = `${apiEntry.api_server_url}${endpoint}${params ? '?' + params.toString() : ''}`;
    const requestOpts: RequestInit = await buildRequestOpts(apiEntry, apiRequest);

    let response  = await fetch(url, requestOpts);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${url} returned ${response.status}: ${text.slice(0, 200)}`);
    }

    const message = { type: "text", text }

    return { content: [message] };
  }
}

export default toolDefinition;
