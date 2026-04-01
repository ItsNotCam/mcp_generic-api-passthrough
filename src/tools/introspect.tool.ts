import { getConfig } from "../configuration/config";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ToolDefinition } from "../types";
import z from "zod";

const { apis } = getConfig();

const toolDefinition: ToolDefinition = {
    name: "list_routes",
    config: {
        description: "Returns the available API routes and their allowed methods and endpoint patterns. Call this before making requests to understand what is available.",
        inputSchema: z.object({}),
    },
    function: async (_args: unknown, _: RequestHandlerExtra<any, any>): Promise<any> => {
        const routes = Object.entries(apis).map(([route, entry]) => ({
            mcp_route: route,
            description: entry.description,
            allowed: entry.routes.allow.map(rule => ({
                methods: rule.methods,
                api_endpoint_matchers: rule.api_endpoint_matchers.map(r => r.source),
            })),
            denied: entry.routes.deny.map(rule => ({
                methods: rule.methods,
                api_endpoint_matchers: rule.api_endpoint_matchers.map(r => r.source),
            })),
        }));

        return {
            content: [{ type: "text", text: JSON.stringify(routes, null, 2) }]
        };
    }
}

export default toolDefinition;
