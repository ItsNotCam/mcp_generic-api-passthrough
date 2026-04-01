import z from "zod";
import { getEnv } from "./env";

export const secretSchema = z.object({
    headers: z
        .record(z.string(), z.string())
        .transform((header) => new Headers(header))
        .optional()
})
export type Secret = z.infer<typeof secretSchema>;

const decryptString = async(secret: string, key: string): Promise<string> => {
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        Buffer.from(key, "hex"),
        { name: "AES-GCM" },
        false,
        ["decrypt"]
    );

    const bytes = new Uint8Array(Buffer.from(secret, "base64"));
    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);

    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        cryptoKey,
        ciphertext,
    );

    return new TextDecoder().decode(decrypted);
}

export const decryptAuthorization = async ({ headers }: Secret): Promise<Secret> => {
    const env = getEnv();

    let out: Secret = { }

    if(headers) {
        out.headers = new Headers(Object.fromEntries(await Promise.all(
            headers.entries().map(async ([key, value]) => [key, await decryptString(value, env.ENCRYPTION_KEY)])
        )))
    }

    return out;
};