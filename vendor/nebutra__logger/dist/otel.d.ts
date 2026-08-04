import { Meter } from '@opentelemetry/api';

/**
 * Initialize OpenTelemetry SDK.
 * No-op unless OTEL_ENABLED=true.
 *
 * Environment variables:
 *   OTEL_ENABLED=true                          — activate tracing
 *   OTEL_EXPORTER_OTLP_ENDPOINT=https://...   — Sentry / Datadog / Grafana / Jaeger
 *   OTEL_EXPORTER_OTLP_HEADERS=...            — auth headers (e.g. "Authorization=Bearer ...")
 *   OTEL_SERVICE_NAME=my-service              — override service name
 *   OTEL_SAMPLE_RATE=0.1                      — fraction of traces to export (default: 0.1 in prod, 1.0 in dev)
 */
declare function initOtel(opts: {
    serviceName: string;
}): void;
/**
 * Return a named OTel Meter. Falls back to a no-op meter when OTEL is disabled.
 */
declare function getMeter(name: string): Meter;
/**
 * Increment the HTTP request counter. No-op when OTEL is disabled.
 */
declare function recordHttpRequest(attributes?: Record<string, string>): void;
/**
 * Increment the HTTP error counter. No-op when OTEL is disabled.
 */
declare function recordHttpError(attributes?: Record<string, string>): void;

export { getMeter, initOtel, recordHttpError, recordHttpRequest };
