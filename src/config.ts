import { RouteConfigSchema, type RouteConfig } from "./types";
import * as fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ override: false })

let _config: RouteConfig | null = null;

export const getConfig = () => {
	if(_config) return _config;
	const configFile: string = fs.readFileSync("./config.json", "utf-8");
	_config = RouteConfigSchema.parse(JSON.parse(configFile))
	return _config;
}