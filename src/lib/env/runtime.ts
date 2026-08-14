export function mockSimulatorAllowed(env: { NODE_ENV?: string; VERCEL_ENV?: string }) {
  if (env.VERCEL_ENV) return env.VERCEL_ENV !== "production";
  return env.NODE_ENV !== "production";
}
