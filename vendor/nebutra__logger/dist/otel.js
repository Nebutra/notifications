// src/otel.ts
import { metrics } from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ParentBasedSampler, TraceIdRatioBasedSampler } from "@opentelemetry/sdk-trace-node";
var sdk = null;
var httpRequestCounter = null;
var httpErrorCounter = null;
function initOtel(opts) {
  if (process.env.OTEL_ENABLED !== "true") return;
  const serviceName = process.env.OTEL_SERVICE_NAME ?? opts.serviceName;
  const isProduction = process.env.NODE_ENV === "production";
  const sampleRate = process.env.OTEL_SAMPLE_RATE ? parseFloat(process.env.OTEL_SAMPLE_RATE) : isProduction ? 0.1 : 1;
  const sampler = new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(
      Math.max(0, Math.min(1, sampleRate))
      // clamp to [0, 1]
    )
  });
  const metricExporter = new OTLPMetricExporter();
  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: isProduction ? 6e4 : 1e4
  });
  sdk = new NodeSDK({
    serviceName,
    sampler,
    traceExporter: new OTLPTraceExporter(),
    metricReader,
    // Explicit instrumentation list (NOT getNodeAutoInstrumentations()).
    //
    // Rationale: auto-instrumentations-node statically pulls in 30+ instrumentations,
    // several of which (winston, mongodb, kafkajs, aws-sdk, mysql, express, fastify,
    // nestjs-core, …) have peer-dep imports we never satisfy because the codebase
    // doesn't use those runtimes. The most painful instance: instrumentation-winston
    // imports `@opentelemetry/winston-transport`, which is not in our dep tree —
    // Next.js webpack walks that static import graph during bundling and fails with
    // `Module not found: Can't resolve '@opentelemetry/winston-transport'`.
    //
    // Listing only what we actually instrument (http, undici-fetch, postgres,
    // ioredis, pino) keeps the bundler graph clean and the runtime overhead small.
    // Add a new instrumentation here ONLY when a corresponding runtime library is
    // imported somewhere in the codebase.
    instrumentations: [
      new HttpInstrumentation(),
      new UndiciInstrumentation(),
      new PgInstrumentation(),
      new IORedisInstrumentation(),
      new PinoInstrumentation()
    ]
  });
  sdk.start();
  const meter = metrics.getMeter(serviceName);
  httpRequestCounter = meter.createCounter("http.server.request.count", {
    description: "Total number of HTTP requests received"
  });
  httpErrorCounter = meter.createCounter("http.server.error.count", {
    description: "Total number of HTTP error responses (4xx/5xx)"
  });
  process.on("SIGTERM", async () => {
    await sdk?.shutdown();
  });
}
function getMeter(name) {
  return metrics.getMeter(name);
}
function recordHttpRequest(attributes) {
  httpRequestCounter?.add(1, attributes);
}
function recordHttpError(attributes) {
  httpErrorCounter?.add(1, attributes);
}
export {
  getMeter,
  initOtel,
  recordHttpError,
  recordHttpRequest
};
