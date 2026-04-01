import Fastify from 'fastify';
import cors from '@fastify/cors';
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfig } from './configuration/config';

export async function createServer(createMcpServer: () => McpServer, host = "0.0.0.0", port = 3000) {
	const { mcp_route } = getConfig();

	const fastify = Fastify({ logger: true });

	await fastify.register(cors, {
		origin: true,
		allowedHeaders: ['Content-Type', 'mcp-session-id'],
		exposedHeaders: ['mcp-session-id'], // 👈 this is what's missing
		methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
	});

	const transports = new Map<string, StreamableHTTPServerTransport>();

	fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
		try { done(null, JSON.parse(body as string)); }
		catch (err) { done(err as Error); }
	});

	fastify.setErrorHandler((error, _request, reply) => {
		console.error('[mcp-server] unhandled error:', error);
		reply.status(500).send({ error: (error as Error).message });
	});

	fastify.post(mcp_route, async (request, reply) => {
		const existingId = request.headers['mcp-session-id'] as string | undefined;
		let transport = existingId ? transports.get(existingId) : undefined;

		// Reject non-initialize requests that arrive without a valid session
		if (!transport) {
			const isInitialize = (request.body as any)?.method === 'initialize';
			if (!isInitialize) {
				return reply.status(400).send({ error: 'No session. Send initialize first.' });
			}

			const sessionId = randomUUID();
			transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => sessionId });
			transports.set(sessionId, transport);
			transport.onclose = () => {
				transports.delete(sessionId);
				fastify.log.info(`[mcp-server] session closed: ${sessionId}`);
			};
			await createMcpServer().connect(transport);
			fastify.log.info(`[mcp-server] session created: ${sessionId}`);
		}

		reply.hijack();
		await transport.handleRequest(request.raw, reply.raw, request.body);
	});

	fastify.get(mcp_route, async (request, reply) => {
		const sessionId = request.headers['mcp-session-id'] as string | undefined;
		if (!sessionId) return reply.status(400).send({ error: 'mcp-session-id header required' });
		const transport = transports.get(sessionId);
		if (!transport) return reply.status(404).send({ error: 'Session not found' });
		reply.hijack();
		await transport.handleRequest(request.raw, reply.raw);
	});

	fastify.delete(mcp_route, async (request, reply) => {
		const sessionId = request.headers['mcp-session-id'] as string | undefined;
		if (!sessionId) return reply.status(400).send({ error: 'mcp-session-id header required' });
		const transport = transports.get(sessionId);
		if (!transport) return reply.status(404).send({ error: 'Session not found' });
		reply.hijack();
		await transport.handleRequest(request.raw, reply.raw);
	});

	await fastify.listen({ port, host });
	return fastify;
}