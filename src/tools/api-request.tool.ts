import { getConfig } from "../config";
import { ApiRequestSchema, ApiRequestInputSchema, type ApiRequest, type ToolDefinition } from "../types";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";

const { server_url, routes, auth_headers } = getConfig();

const ApiRequestToolName = "request";
const ApiRequestToolConfig = {
	description: "Make a request to an endpoint",
	inputSchema: ApiRequestInputSchema,
}

const ApiRequestToolFunction = async(
  rawArgs: unknown,
  _: RequestHandlerExtra<any, any>
): Promise<any> => {
  const { method, endpoint, params, body } = ApiRequestSchema.parse(rawArgs);

  const matchesRule = ({ methods, route_matchers, endpoint_matchers }: typeof routes.allow[number]) =>
    methods.includes(method) &&
    route_matchers.some((p: RegExp) => p.test(endpoint)) &&
    endpoint_matchers.some((p: RegExp) => p.test(endpoint));

  if (routes.deny.some(matchesRule)) throw new Error("Request is denied");
  if (!routes.allow.some(matchesRule)) throw new Error("That combination of method and url is not allowed");

  const url = `${server_url}${endpoint}${params ? '?' + params.toString() : ''}`;
  console.log(`Attempting to reach ${url}...`);

  const requestBody = body !== undefined && !['GET', 'HEAD'].includes(method) ? { body } : {};
  const { response, data } = await fetch(url, {
    method,
    headers: auth_headers,
    ...requestBody
  }).then(async (response) => ({ response, data: await response.json() }));

  if (!response.ok) throw new Error(`Failed to reach ${url} with status: ${response.status}`);

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