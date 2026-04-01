import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfig } from './config';
import { ApiRequestTool } from './tools';
import { createServer } from './server';
import { getEnv } from './env';

const { HOST, PORT } = getEnv();
const config = getConfig();

const server = new McpServer({
	name: config.name,
	version: "1.0.0"
})

server.registerTool(
	ApiRequestTool.name,
	ApiRequestTool.config,
	ApiRequestTool.function as any
);

async function main() {
	console.log(`Starting server on ${HOST}:${PORT}`)
	await createServer(server, HOST, PORT);
}

main().catch((error) => {
	console.error("Fatal error in main():", error);
	process.exit(1);
});