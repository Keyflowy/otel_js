import process from 'node:process'
import { SpanKind, metrics } from '@opentelemetry/api'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'

const sdkKey = Symbol.for('otel-js.sdk')

function resolveSampleRate(value) {
  if (value == null || value.trim() === '') {
    return 1
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    console.error('[OTel] Invalid OTEL_TRACES_SAMPLE_RATE, expected a number between 0 and 1')
    process.exit(1)
  }

  return parsed
}

function resolveMetricsExportInterval(value) {
  if (value == null || value.trim() === '') {
    return 60_000
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error('[OTel] Invalid OTEL_METRICS_EXPORT_INTERVAL, expected a positive number of milliseconds')
    process.exit(1)
  }

  return parsed
}

function registerProcessMemoryMetrics() {
  const meter = metrics.getMeter('otel-js')
  const rssGauge = meter.createObservableGauge('nodejs.process.memory.rss', {
    description: 'Resident set size for the current Node.js process',
    unit: 'By'
  })
  const heapUsedGauge = meter.createObservableGauge('nodejs.process.memory.heap.used', {
    description: 'V8 heap currently used by the current Node.js process',
    unit: 'By'
  })
  const externalGauge = meter.createObservableGauge('nodejs.process.memory.external', {
    description: 'Memory used by C++ objects bound to JavaScript objects',
    unit: 'By'
  })

  meter.addBatchObservableCallback((observableResult) => {
    const memoryUsage = process.memoryUsage()

    observableResult.observe(rssGauge, memoryUsage.rss)
    observableResult.observe(heapUsedGauge, memoryUsage.heapUsed)
    observableResult.observe(externalGauge, memoryUsage.external)
  }, [
    rssGauge,
    heapUsedGauge,
    externalGauge
  ])
}

class RouteAwareSampler {
  constructor(defaultRate, apiRate) {
    this.defaultSampler = new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(defaultRate)
    })
    this.apiSampler = new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(apiRate)
    })
  }

  shouldSample(context, traceId, spanName, spanKind, attributes, links) {
    const target = attributes?.['http.target']
    const route = attributes?.['http.route']
    const url = attributes?.['url.path']
    const path = typeof route === 'string'
      ? route
      : typeof target === 'string'
        ? target
        : typeof url === 'string'
          ? url
          : ''

    if (spanKind === SpanKind.SERVER && path.startsWith('/api')) {
      return this.apiSampler.shouldSample(context, traceId, spanName, spanKind, attributes, links)
    }

    return this.defaultSampler.shouldSample(context, traceId, spanName, spanKind, attributes, links)
  }

  toString() {
    return 'RouteAwareSampler'
  }
}

if (!globalThis[sdkKey]) {
  const otelEndpoint = process.env.SIGNOZ_OTEL_EXPORTER_ENDPOINT
  const otelAuthKey = process.env.SIGNOZ_OTEL_AUTH_KEY || ''
  const serviceName = process.env.OTEL_SERVICE_NAME || 'blog'
  const sampleRate = resolveSampleRate(process.env.OTEL_TRACES_SAMPLE_RATE)
  const apiSampleRate = process.env.OTEL_API_TRACES_SAMPLE_RATE == null || process.env.OTEL_API_TRACES_SAMPLE_RATE.trim() === ''
    ? sampleRate
    : resolveSampleRate(process.env.OTEL_API_TRACES_SAMPLE_RATE)
  const metricsExportInterval = resolveMetricsExportInterval(process.env.OTEL_METRICS_EXPORT_INTERVAL)

  if (!otelEndpoint) {
    console.error('[OTel] Missing SIGNOZ_OTEL_EXPORTER_ENDPOINT')
    process.exit(1)
  }

  const traceEndpoint = otelEndpoint
  const metricsEndpoint = otelEndpoint.replace(/\/v1\/traces$/, '/v1/metrics')
  const headers = {}
  if (otelAuthKey) {
    headers['x-otel-key'] = otelAuthKey
  }

  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({
      url: traceEndpoint,
      headers
    }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: metricsEndpoint,
        headers
      }),
      exportIntervalMillis: metricsExportInterval
    }),
    sampler: new RouteAwareSampler(sampleRate, apiSampleRate),
    instrumentations: [getNodeAutoInstrumentations()],
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName
    })
  })

  sdk.start()
  registerProcessMemoryMetrics()
  globalThis[sdkKey] = sdk

  process.once('SIGTERM', () => {
    sdk.shutdown()
      .then(() => console.log('[OTel] Tracing terminated'))
      .catch((error) => console.error('[OTel] Error terminating tracing', error))
      .finally(() => process.exit(0))
  })

  console.log('[OTel] Tracing initialized', {
    endpoint: traceEndpoint,
    serviceName,
    authEnabled: !!otelAuthKey,
    sampleRate,
    apiSampleRate,
    metricsExportInterval
  })
}
