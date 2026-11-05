import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

/** Folder for auth and cache files: %LOCALAPPDATA%\streamdeck-oura on Windows. */
export function dataDir(): string {
	const base =
		process.env.LOCALAPPDATA ??
		(process.platform === "darwin"
			? path.join(os.homedir(), "Library", "Application Support")
			: path.join(os.homedir(), ".local", "share"));
	return path.join(base, "streamdeck-oura");
}

export async function readJson<T>(file: string): Promise<T | undefined> {
	try {
		return JSON.parse(await fs.readFile(file, "utf8")) as T;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		if (err instanceof SyntaxError) return undefined;
		throw err;
	}
}

/**
 * Write JSON so a crash never leaves a half-written file: write a temp file, then rename over
 * the target. Windows can briefly refuse the rename (EPERM/EBUSY) when another process holds
 * the file, so retry a few times.
 */
export async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
	await fs.mkdir(path.dirname(file), { recursive: true });
	const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
	await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
	for (let attempt = 0; ; attempt++) {
		try {
			await fs.rename(tmp, file);
			return;
		} catch (err) {
			const code = (err as NodeJS.ErrnoException).code;
			if ((code === "EPERM" || code === "EBUSY" || code === "EACCES") && attempt < 5) {
				await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
				continue;
			}
			await fs.rm(tmp, { force: true });
			throw err;
		}
	}
}
