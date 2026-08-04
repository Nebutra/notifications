import {
  logger
} from "./chunk-5QXR2U6T.js";

// src/otel-bootstrap.ts
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { LangfuseExporter } from "langfuse-vercel";
var initialized = false;
var activeSdk = null;
var shutdownHookInstalled = false;
function initGlobalOtel(opts) {
  if (initialized) return activeSdk;
  initialized = true;
  if (process.env.OTEL_ENABLED === "true") {
    logger.debug("initGlobalOtel: legacy OTEL_ENABLED path active, skipping");
    return null;
  }
  const includeLangfuse = opts.includeLangfuse !== false;
  const langfuseConfigured = includeLangfuse && Boolean(process.env.LANGFUSE_PUBLIC_KEY) && Boolean(process.env.LANGFUSE_SECRET_KEY);
  const otlpConfigured = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
  if (!langfuseConfigured && !otlpConfigured) {
    logger.debug("initGlobalOtel: no exporters configured, skipping");
    return null;
  }
  const spanProcessors = [];
  if (langfuseConfigured) {
    try {
      const langfuseParams = {};
      if (process.env.LANGFUSE_PUBLIC_KEY)
        langfuseParams.publicKey = process.env.LANGFUSE_PUBLIC_KEY;
      if (process.env.LANGFUSE_SECRET_KEY)
        langfuseParams.secretKey = process.env.LANGFUSE_SECRET_KEY;
      if (process.env.LANGFUSE_HOST) langfuseParams.baseUrl = process.env.LANGFUSE_HOST;
      const langfuseExporter = new LangfuseExporter(langfuseParams);
      spanProcessors.push(new BatchSpanProcessor(langfuseExporter));
      logger.info("OTel: Langfuse exporter registered", { service: opts.serviceName });
    } catch (err) {
      logger.warn("OTel: failed to register Langfuse exporter", {
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
  if (otlpConfigured) {
    try {
      const otlpExporter = new OTLPTraceExporter();
      spanProcessors.push(new BatchSpanProcessor(otlpExporter));
      logger.info("OTel: OTLP trace exporter registered", { service: opts.serviceName });
    } catch (err) {
      logger.warn("OTel: failed to register OTLP exporter", {
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
  if (spanProcessors.length === 0) {
    return null;
  }
  try {
    const sdk = new NodeSDK({
      serviceName: opts.serviceName,
      spanProcessors
      // No auto-instrumentations here — keep this path lightweight. Manual
      // spans (Vercel AI SDK `experimental_telemetry`, Sentry's own OTel
      // integration) are picked up via the global tracer provider.
    });
    sdk.start();
    activeSdk = sdk;
    if (!shutdownHookInstalled) {
      shutdownHookInstalled = true;
      const shutdown = async () => {
        try {
          await sdk.shutdown();
        } catch (err) {
          logger.warn("OTel: shutdown failed", {
            error: err instanceof Error ? err.message : String(err)
          });
        }
      };
      process.on("SIGTERM", shutdown);
      process.on("SIGINT", shutdown);
      process.on("beforeExit", shutdown);
    }
    return sdk;
  } catch (err) {
    logger.warn("OTel: NodeSDK start failed", {
      error: err instanceof Error ? err.message : String(err)
    });
    return null;
  }
}
function _resetGlobalOtelForTests() {
  initialized = false;
  activeSdk = null;
  shutdownHookInstalled = false;
}
export {
  _resetGlobalOtelForTests,
  initGlobalOtel
};
