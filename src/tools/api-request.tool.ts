import { getConfig } from "../config";
import { ApiRequestSchema, type ApiRequest, type ToolDefinition } from "../types";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";

const { server_url, routes, auth_headers } = getConfig();

const ApiRequestToolName = "request";
const ApiRequestToolConfig = {
	description: "Make a request to an endpoint",
	inputSchema: ApiRequestSchema,
}

const ApiRequestToolFunction = async(
  { method, endpoint, params, body }: ApiRequest,
  _: RequestHandlerExtra<any, any>
): Promise<any> => {
    for(const { allowed_methods, route_matchers, endpoint_matchers } of routes) {
      if(!allowed_methods.includes(method)) continue;
      if(!route_matchers.some((pattern: RegExp) => pattern.test(endpoint))) continue;
      if(!endpoint_matchers.some((pattern: RegExp) => pattern.test(endpoint))) continue;

      const url = `${server_url}/${endpoint}${params ? '?' + params.toString() : ''}`
			const requestBody = (body !== undefined && !['GET', 'HEAD'].includes(method) ? { body } : {})
      const response = await fetch(url, {
        method,
        headers: auth_headers,
        ...requestBody
      }).then((r) => r.json())

      return {
        content: [{
          type: "text",
          text: JSON.stringify(response)
        }]
      }
    }

    throw new Error("That combination of method and url is not allowed");
}

const toolDefinition: ToolDefinition = {
	name: ApiRequestToolName,
	config: ApiRequestToolConfig,
	function: ApiRequestToolFunction
}

export default toolDefinition;