# otel_js

Standalone OpenTelemetry preload for Node.js apps built elsewhere.

## Install

```bash
bun install
```

## Run a built Nuxt Nitro server

The target app should already be built in CI and available as an ESM entry such as `.output/server/index.mjs`.

```bash
node ./run.mjs /path/to/.output/server/index.mjs
```

This wrapper runs Node with:

```bash
node \
  --experimental-loader ./node_modules/@opentelemetry/instrumentation/hook.mjs \
  --import ./tracing.mjs \
  /path/to/.output/server/index.mjs
```

## Environment

- `SIGNOZ_OTEL_EXPORTER_ENDPOINT`
- `SIGNOZ_OTEL_AUTH_KEY`
- `OTEL_SERVICE_NAME`
- `OTEL_TRACES_SAMPLE_RATE`
- `OTEL_API_TRACES_SAMPLE_RATE`
- `OTEL_METRICS_EXPORT_INTERVAL`
- `OTEL_LOG_LEVEL`

`SIGNOZ_OTEL_EXPORTER_ENDPOINT` is required. Example:

```bash
export SIGNOZ_OTEL_EXPORTER_ENDPOINT="https://your-signoz.example.com/v1/traces"
export SIGNOZ_OTEL_AUTH_KEY="replace-me"
export OTEL_SERVICE_NAME="blog"
export OTEL_TRACES_SAMPLE_RATE="0.1"
export OTEL_API_TRACES_SAMPLE_RATE="1"
export OTEL_METRICS_EXPORT_INTERVAL="60000"
node ./run.mjs /path/to/.output/server/index.mjs
```
