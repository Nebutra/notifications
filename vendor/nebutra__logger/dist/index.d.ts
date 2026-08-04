type LogLevel = "debug" | "info" | "warn" | "error";
type Meta = Record<string, unknown>;
interface Logger {
    debug(msg: string, meta?: Meta): void;
    info(msg: string, meta?: Meta): void;
    warn(msg: string, meta?: Meta): void;
    error(msg: string, error?: unknown, meta?: Meta): void;
    child(bindings: Meta): Logger;
}

declare const logger: Logger;
/**
 * Returns a child logger that automatically includes `requestId` in every log
 * line produced by the returned logger.  Use this inside request handlers or
 * middleware to tie log output to a specific HTTP request.
 *
 * @example
 * const reqLogger = withRequestId(c.get("requestId"));
 * reqLogger.info("processing payment", { userId });
 */
declare function withRequestId(requestId: string): Logger;

export { type LogLevel, type Logger, type Meta, logger, withRequestId };
