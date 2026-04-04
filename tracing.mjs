import process from 'node:process'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'

const sdkKey = Symbol.for('otel-js.sdk')

if (!globalThis[sdkKey]) {
  const otelEndpoint = process.env.SIGNOZ_OTEL_EXPORTER_ENDPOINT
  const otelAuthKey = process.env.SIGNOZ_OTEL_AUTH_KEY || ''
  const serviceName = process.env.OTEL_SERVICE_NAME || 'blog'

  if (!otelEndpoint) {
    console.error('[OTel] Missing SIGNOZ_OTEL_EXPORTER_ENDPOINT')
    process.exit(1)
  }

  const headers = {}
  if (otelAuthKey) {
    headers['x-otel-key'] = otelAuthKey
  }

  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({
      url: otelEndpoint,
      headers
    }),
    instrumentations: [getNodeAutoInstrumentations()],
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName
    })
  })

  sdk.start()
  globalThis[sdkKey] = sdk

  process.once('SIGTERM', () => {
    sdk.shutdown()
      .then(() => console.log('[OTel] Tracing terminated'))
      .catch((error) => console.error('[OTel] Error terminating tracing', error))
      .finally(() => process.exit(0))
  })

  console.log('[OTel] Tracing initialized', {
    endpoint: otelEndpoint,
    serviceName,
    authEnabled: !!otelAuthKey
  })
}
