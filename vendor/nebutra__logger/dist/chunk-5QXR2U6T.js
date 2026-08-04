// src/logger.ts
import { context, trace } from "@opentelemetry/api";
import pino from "pino";

// src/sentry-transport.ts
var sentryRef = null;
var loadAttempted = false;
async function loadSentry() {
  if (sentryRef) return sentryRef;
  if (loadAttempted) return null;
  loadAttempted = true;
  if (process.env.LOGGER_SENTRY_ENABLED !== "true") return null;
  if (!process.env.SENTRY_DSN) return null;
  if (typeof globalThis !== "undefined" && "window" in globalThis) return null;
  try {
    const dynImport = new Function("p", "return import(p)");
    const mod = await dynImport("@sentry/node").catch(() => null);
    if (mod && typeof mod.captureException === "function") {
      sentryRef = mod;
      return mod;
    }
  } catch {
  }
  return null;
}
function isSentryTransportEnabled() {
  return process.env.LOGGER_SENTRY_ENABLED === "true" && !!process.env.SENTRY_DSN;
}
function forwardErrorToSentry(msg, error, meta) {
  if (!isSentryTransportEnabled()) return;
  void loadSentry().then((sentry) => {
    if (!sentry) return;
    const err = error instanceof Error ? error : new Error(msg);
    sentry.captureException(err, { extra: { logMessage: msg, ...meta ?? {} } });
  });
}
function forwardWarnToSentry(msg, meta) {
  if (!isSentryTransportEnabled()) return;
  void loadSentry().then((sentry) => {
    if (!sentry) return;
    sentry.addBreadcrumb({
      category: "logger",
      level: "warning",
      message: msg,
      ...meta ? { data: meta } : {}
    });
  });
}

// src/logger.ts
var isDev = process.env.NODE_ENV === "development";
var isTest = process.env.NODE_ENV === "test";
var REDACTED_FIELDS = [
  "password",
  "token",
  "secret",
  "apiKey",
  "api_key",
  "authorization",
  "cookie",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "privateKey",
  "private_key",
  "creditCard",
  "cardNumber"
];
var pinoInstance = pino({
  redact: { paths: REDACTED_FIELDS, censor: "[REDACTED]" },
  ...isTest ? { level: "silent" } : {
    level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
    ...isDev ? {
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:HH:MM:ss" }
      }
    } : {}
  }
});
function serializeError(error) {
  if (error == null) {
    return {};
  }
  if (error instanceof Error) {
    return {
      err: { message: error.message, stack: error.stack, name: error.name }
    };
  }
  return { err: error };
}
function getTraceId() {
  try {
    const span = trace.getSpan(context.active());
    const id = span?.spanContext().traceId;
    return id && id !== "00000000000000000000000000000000" ? id : void 0;
  } catch {
    return void 0;
  }
}
function makeLogger(base) {
  return {
    debug(msg, meta) {
      const traceId = getTraceId();
      base.debug({ ...meta, ...traceId ? { traceId } : {} }, msg);
    },
    info(msg, meta) {
      const traceId = getTraceId();
      base.info({ ...meta, ...traceId ? { traceId } : {} }, msg);
    },
    warn(msg, meta) {
      const traceId = getTraceId();
      base.warn({ ...meta, ...traceId ? { traceId } : {} }, msg);
      forwardWarnToSentry(msg, meta);
    },
    error(msg, error, meta) {
      const traceId = getTraceId();
      base.error({ ...serializeError(error), ...meta, ...traceId ? { traceId } : {} }, msg);
      forwardErrorToSentry(msg, error, meta);
    },
    child(bindings) {
      return makeLogger(base.child(bindings));
    }
  };
}
var logger = makeLogger(pinoInstance);
function withRequestId(requestId) {
  return logger.child({ requestId });
}

export {
  logger,
  withRequestId
};
