import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import z from "zod";

export const HTTPMethod = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;

const RouteSchema = z.object({
	methods: z.array(
		z.string()
		.transform((method: string) => method.toUpperCase())
		.pipe(z.enum(HTTPMethod))
	),
	
	route_matchers: z.array(
		z.string().transform((pattern) => new RegExp(pattern))
	),

	endpoint_matchers: z.array(
		z.string().transform((pattern) => new RegExp(pattern))
	)
})

export const RouteConfigSchema = z.object({
	name: z.string().min(1),
	server_url: z.string().min(1),
	auth_headers: z.record(z.string(), z.string()),
	routes: z.object({
		allow: z.array(RouteSchema),
		deny: z.array(RouteSchema),
	}),
	mcp_route: z.string().min(1),
}).transform(({auth_headers, ...rest}) => {
	for(const [key, value] of Object.entries<string>(auth_headers)) {
		auth_headers[key] = value.replace("%AUTH_HEADER_SECRET%", process.env.AUTH_HEADER_SECRET ?? "")
	}
	return { auth_headers, ...rest }
})


export const ApiRequestInputSchema = z.object({
	method: z.enum(HTTPMethod),
	endpoint: z.string().min(1),
	body: z.any().optional()
})

export const ApiRequestSchema = ApiRequestInputSchema.transform(({ method, endpoint, body }) => {
	const [ url, params ] = endpoint.split("?");
	return {
		method,
		endpoint: url ?? endpoint,
		params: params ? new URLSearchParams(params) : undefined,
		body,
	}
})

export type RouteConfig = z.infer<typeof RouteConfigSchema>;
export type ApiRequest = z.infer<typeof ApiRequestSchema>;

export interface ToolDefinition {
	name: string,
	config: any,
	function: (args: any, extra: RequestHandlerExtra<any, any>) => Promise<any>,
}
