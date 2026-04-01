import z from "zod";

const env = z.object({
	AUTH_HEADER_SECRET: z.string().min(1),
	HOST: z.string().min(1),
	PORT: z.coerce.number().int()
})

type Env = z.infer<typeof env>;

let _env: Env | null = null;

export const getEnv = () => {
	if(_env) return _env;
	_env = env.parse(process.env);
	return _env;
}