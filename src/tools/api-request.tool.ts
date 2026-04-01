import { ApiRequestInputSchema, ApiRequestSchema, getConfig } from "../configuration/config";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ToolDefinition } from "../types";
import { decryptAuthorization } from "../configuration/secrets";

const { apis } = getConfig();

const ApiRequestToolName = "request";
const ApiRequestToolConfig = {
	description: "Make a request to an endpoint",
	inputSchema: ApiRequestInputSchema,
}

const BLOCKED_HEADERS = [
  "authorization", 
  "cookie", 
  "x-api-key", 
  "x-auth-token"
];

function mergeHeaders(configHeaders: Headers, toolHeaders?: Headers, extraBlocked: string[] = []): Headers {
  const merged = new Headers(toolHeaders); // Claude's first (bottom)
  [...BLOCKED_HEADERS, ...extraBlocked].forEach(h => merged.delete(h)); // strip sensitive
  configHeaders.forEach((val, key) => merged.set(key, val)); // yours win
  return merged;
}

const ApiRequestToolFunction = async(
  rawArgs: unknown,
  _: RequestHandlerExtra<any, any>
): Promise<any> => {
  const { mcp_route, method, endpoint, params, headers, body } = ApiRequestSchema.parse(rawArgs);

  if (/(\.\.|\/\/|\\)/.test(endpoint)) throw new Error("Invalid endpoint");

  const apiEntry = apis[mcp_route];
  if (!apiEntry) throw new Error(`No API configured for route: ${mcp_route}`);

  const { routes, api_server_url, authorization, blocked_headers } = apiEntry;

  const matchesRule = ({ methods, api_endpoint_matchers }: typeof routes.allow[number]) =>
    methods.includes(method) &&
    api_endpoint_matchers.some((p: RegExp) => p.test(endpoint));

  if (routes.deny.some(matchesRule)) throw new Error("Request is denied");
  if (!routes.allow.some(matchesRule)) throw new Error("That combination of method and url is not allowed");

  const url = `${api_server_url}${endpoint}${params ? '?' + params.toString() : ''}`;
  const auth = await decryptAuthorization(authorization);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: mergeHeaders(auth.headers ?? new Headers(), headers, blocked_headers),
      ...(body !== undefined && !['GET', 'HEAD'].includes(method) ? { body: JSON.stringify(body) } : {})
    });
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(`Network error reaching ${url}: ${cause}`);
  }

  const text = await response.text();
  if (!response.ok) throw new Error(`${url} returned ${response.status}: ${text.slice(0, 200)}`);

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${url} returned non-JSON response: ${text.slice(0, 200)}`);
  }

  return {
    content: [{ type: "text", text: JSON.stringify(data) }]
  };
}

const toolDefinition: ToolDefinition = {
	name: ApiRequestToolName,
	config: ApiRequestToolConfig,
	function: ApiRequestToolFunction
}

export default toolDefinition;