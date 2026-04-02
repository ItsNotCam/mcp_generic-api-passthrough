import * as fs from 'fs';
import dotenv from 'dotenv';
import z from 'zod';
import { AuthConfigSchema } from './secrets';
import { YAML } from 'bun';

// config
dotenv.config({ override: false })
let _config: AppConfig | null = null;
export const getConfig = () => {
	if (_config) return _config;
	const configFile: string = fs.readFileSync("./config.yaml", "utf-8");
	_config = AppConfigSchema.parse(YAML.parse(configFile))
	return _config;
}

const safePattern = (r: string) => r.startsWith('^') ? r : `^${r}`;

/* Api */
export const HTTPMethod = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;
export const ApiRequestInputSchema = z.object({
	mcp_route: z.string().min(1).regex(/^\/.*/),
	method: z.enum(HTTPMethod),
	endpoint: z.string().min(1),
	headers: z.record(z.string(), z.string()).optional(),
	body: z.any().optional()
})

export const ApiRequestSchema = ApiRequestInputSchema.transform(({
	method,
	endpoint,
	body,
	mcp_route,
	headers
}) => {
	const [ url, params ] = endpoint.split("?");
	return {
		mcp_route,
		method,
		endpoint: url ?? endpoint,
		params: params ? new URLSearchParams(params) : undefined,
		headers: headers ? new Headers(headers) : undefined,
		body,
	}
})

/* Config File */
export const FirewallRuleSchema = z.object({
	methods: z.array(z
		.string()
		.transform((method: string) => method.toUpperCase())
		.pipe(z.enum(HTTPMethod))
	),
	api_endpoint_matchers: z.array(z
		.string()
		.transform((pattern) => new RegExp(safePattern(pattern)))
	),
})

export const RouteFirewallSchema = z.object({
	allow: z.array(FirewallRuleSchema),
	deny: z.array(FirewallRuleSchema)
})

export const ApiConfigSchema = z.object({
	api_server_url: z.string().min(1),
	description: z.string().optional(),
	blocked_headers: z.array(z.string().transform(h => h.toLowerCase())).default([]),
	scrub_response: z.array(z.string().transform((p) => new RegExp(p, 'g'))).default([]),
	deny_fields: z.array(z.string()).default([]),
	authorization: AuthConfigSchema,
	routes: RouteFirewallSchema
})

export const AppConfigSchema = z.object({
	name: z.string().min(1),
	version: z.string().min(1),
	mcp_route: z.string().min(1).regex(/^\/.*/).default("/mcp"),
	description: z.string().min(1),
	apis: z.record(z.string().min(1).regex(/^\/.*/), ApiConfigSchema),
});

/* types */
export type ApiConfig = z.infer<typeof ApiConfigSchema>;
export type ApiRequest = z.infer<typeof ApiRequestSchema>;
export type FirewallRule = z.infer<typeof FirewallRuleSchema>;
export type RouteFirewall = z.infer<typeof RouteFirewallSchema>;

export type AppConfig = z.infer<typeof AppConfigSchema>;
