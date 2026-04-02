import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiRequestTool, IntrospectTool } from './tools';
import { createServer } from './server';
import { getEnv } from './configuration/env';
import { getConfig } from './configuration/config';

const { HOST, PORT } = getEnv();
const { name, version, description } = getConfig();

function createMcpServer() {
	const server = new McpServer({ name, version, description });
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