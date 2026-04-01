import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfig } from './config';
import { ApiRequestTool } from './tools';
import { createServer } from './server';
import { getEnv } from './env';

const { HOST, PORT } = getEnv();
const config = getConfig();

function createMcpServer() {
	const server = new McpServer({ name: config.name, version: "1.0.0" });
	server.registerTool(ApiRequestTool.name, ApiRequestTool.config, ApiRequestTool.function as any);
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