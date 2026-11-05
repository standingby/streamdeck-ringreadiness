import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

function baseDir(): string {
	return (
		process.env.LOCALAPPDATA ??
		(process.platform === "darwin"
			? path.join(os.homedir(), "Library", "Application Support")
			: path.join(os.homedir(), ".local", "share"))
	);
}

/** Folder for auth and cache files: %LOCALAPPDATA%\ringreadiness on Windows. */
export function dataDir(): string {
	return path.join(baseDir(), "ringreadiness");
}

/**
 * Pre-release builds kept their files in %LOCALAPPDATA%\streamdeck-oura. Copy them once into the
 * new folder so an existing login survives the rename; the old folder is left untouched.
 */
export async function migrateLegacyDataDir(target: string = dataDir(), legacy: string = path.join(baseDir(), "streamdeck-oura")): Promise<boolean> {
	try {
		await fs.access(path.join(target, "auth.json"));
		return false;
	} catch {
		// No auth in the new folder yet: fall through.
	}
	let copied = false;
	for (const name of ["auth.json", "cache.json"]) {
		try {
			await fs.mkdir(target, { recursive: true });
			await fs.copyFile(path.join(legacy, name), path.join(target, name));
			copied = true;
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
		}
	}
	return copied;
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
