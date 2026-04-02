import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";

export interface ToolDefinition {
	name: string,
	config: any,
	function: (args: any, extra: RequestHandlerExtra<any, any>) => Promise<any>,
}
