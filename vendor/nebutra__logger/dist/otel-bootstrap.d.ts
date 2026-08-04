import { NodeSDK } from '@opentelemetry/sdk-node';

/**
 * Global OpenTelemetry NodeSDK bootstrap.
 *
 * Wires up trace export to:
 *   - Langfuse (when LANGFUSE_PUBLIC_KEY + LANGFUSE_SECRET_KEY are set) — for
 *     LLM/AI SDK span capture.
 *   - Generic OTLP endpoint (when OTEL_EXPORTER_OTLP_ENDPOINT is set) — for
 *     vendor-neutral observability backends (Sentry, Grafana, Datadog, ...).
 *
 * Differences vs. {@link initOtel} (otel.ts):
 *   - `initOtel` is opt-in via OTEL_ENABLED=true and registers OTLP traces +
 *     metrics + auto-instrumentations.
 *   - `initGlobalOtel` is the LIGHTWEIGHT path for capturing
 *     `experimental_telemetry` spans from the Vercel AI SDK and shipping them
 *     to Langfuse. It activates whenever Langfuse is configured.
 *   - Both are idempotent. If `initOtel` has already started, `initGlobalOtel`
 *     is a no-op.
 *
 * Sentry interop:
 *   Sentry v8+ uses `@sentry/opentelemetry` under the hood. When this NodeSDK
 *   is registered FIRST, Sentry's Next.js / Node SDK detects an existing
 *   global tracer provider and attaches its own SpanProcessor on top, so both
 *   Sentry AND Langfuse receive spans. Order matters — call this BEFORE
 *   `Sentry.init()`.
 */

interface InitGlobalOtelOptions {
    serviceName: string;
    /** Default true. Set false to skip Langfuse even if env is configured. */
    includeLangfuse?: boolean;
}
/**
 * Initialize the global OTel NodeSDK with Langfuse + optional OTLP exporters.
 *
 * Returns the SDK instance (or null if no exporter was configured / a previous
 * call already initialized). Safe to call repeatedly — second call is a no-op.
 */
declare function initGlobalOtel(opts: InitGlobalOtelOptions): NodeSDK | null;
/** Test helper — resets module-level init state. */
declare function _resetGlobalOtelForTests(): void;

export { _resetGlobalOtelForTests, initGlobalOtel };
