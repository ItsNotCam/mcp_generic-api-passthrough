import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiRequestTool, IntrospectTool } from './tools';
import { createServer } from './server';
import { getEnv } from './configuration/env';

const { HOST, PORT } = getEnv();

const TOOL_DESCRIPTION = `
Make an HTTP request to a configured API backend.

Parameters:
- mcp_route: The API namespace to target (e.g. "/proxmox"). Must begin with "/". Available routes are defined by server config.
- method: HTTP method. Allowed methods vary per route — do not assume all methods are available.
- endpoint: The API path to call on the upstream server (e.g. "/api2/json/nodes"). Must satisfy the route's endpoint rules.
- headers: Optional additional request headers. Authorization, cookie, and other sensitive headers are stripped server-side regardless of what is provided.
- body: Optional request body. Ignored on GET requests.

Behavior:
- The server injects authentication automatically — do not attempt to provide auth headers.
- Requests are validated against an allowlist before proxying. Disallowed methods or endpoints will be rejected.
- The server URL is resolved from config — only provide the path in "endpoint".
`.trim();

function createMcpServer() {
	const server = new McpServer({ 
		name: "api-proxy",
		version: "1.0.0",
		description: TOOL_DESCRIPTION 
	});

	server.registerTool(ApiRequestTool.name, ApiRequestTool.config, ApiRequestTool.function as any);
	server.registerTool(IntrospectTool.name, IntrospectTool.config, IntrospectTool.function as any);
	return server;
}

async function main() {
	console.log(`Starting server on ${HOST}:${PORT}`)
	await createServer(createMcpServer, HOST, PORT);
}

main().catch((error) => {
	console.error("Fatal error in main():", error);
	process.exit(1);
});