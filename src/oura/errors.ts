/** Short codes shown on keys. `connect` = nothing configured yet. */
export type ErrorCode = "offline" | "reauth" | "limit" | "connect" | "error";

export class OuraError extends Error {
	constructor(
		message: string,
		readonly code: ErrorCode,
		readonly status?: number,
	) {
		super(message);
		this.name = "OuraError";
	}
}

export function toErrorCode(err: unknown): ErrorCode {
	if (err instanceof OuraError) return err.code;
	return "offline";
}
