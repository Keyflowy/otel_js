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
  --import ./tracing.js \
  /path/to/.output/server/index.mjs
```

## Environment

- `SIGNOZ_OTEL_EXPORTER_ENDPOINT`
- `SIGNOZ_OTEL_AUTH_KEY`
- `OTEL_SERVICE_NAME`
- `OTEL_LOG_LEVEL`

`SIGNOZ_OTEL_EXPORTER_ENDPOINT` is required. Example:

```bash
export SIGNOZ_OTEL_EXPORTER_ENDPOINT="https://your-signoz.example.com/v1/traces"
export SIGNOZ_OTEL_AUTH_KEY="replace-me"
export OTEL_SERVICE_NAME="blog"
node ./run.mjs /path/to/.output/server/index.mjs
```
