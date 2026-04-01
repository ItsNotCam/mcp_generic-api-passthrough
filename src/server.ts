import Fastify from 'fastify';
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfig } from './config';


export async function createServer(mcpServer: McpServer, host = "0.0.0.0", port = 3000) {
	const { mcp_route } = getConfig();

	const fastify = Fastify();
	const transports = new Map<string, StreamableHTTPServerTransport>();

	fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
		try { done(null, JSON.parse(body as string)); }
		catch (err) { done(err as Error); }
	});

	fastify.post(mcp_route, async (request, reply) => {
		const existingId = request.headers['mcp-session-id'] as string | undefined;
		let transport = existingId ? transports.get(existingId) : undefined;

		if (!transport) {
			const sessionId = randomUUID();
			transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => sessionId });
			transports.set(sessionId, transport);
			transport.onclose = () => transports.delete(sessionId);
			await mcpServer.connect(transport);
		}

		await transport.handleRequest(request.raw, reply.raw, request.body);
		reply.hijack();
	});

	fastify.get(mcp_route, async (request, reply) => {
		const sessionId = request.headers['mcp-session-id'] as string | undefined;
		const transport = sessionId ? transports.get(sessionId) : undefined;
		if (!transport) return reply.status(404).send({ error: 'Session not found' });
		await transport.handleRequest(request.raw, reply.raw);
		reply.hijack();
	});

	fastify.delete(mcp_route, async (request, reply) => {
		const sessionId = request.headers['mcp-session-id'] as string | undefined;
		const transport = sessionId ? transports.get(sessionId) : undefined;
		if (!transport) return reply.status(404).send({ error: 'Session not found' });
		await transport.handleRequest(request.raw, reply.raw);
		reply.hijack();
	});

	await fastify.listen({ port, host });
	return fastify;
}
