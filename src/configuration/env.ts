import z from "zod";

let _env: Env | null = null;
export const getEnv = () => {
	if(_env) return _env;
	_env = envSchema.parse(process.env);
	return _env;
}

/*
* Schema
*/
export const envSchema = z.object({
	ENCRYPTION_KEY: z.string().length(64),
	HOST: z.string().min(1),
	PORT: z.coerce.number().int()
})

export type Env = z.infer<typeof envSchema>;