import { registerOTel } from "@vercel/otel";

/**
 * Emits traces for Next.js server work and outgoing fetches to ASP.NET.
 * Pair with backend OpenTelemetry (ASP.NET + EF Core) via the same OTLP endpoint.
 */
export function register() {
  registerOTel({
    serviceName: "ejadah-shell",
  });
}
