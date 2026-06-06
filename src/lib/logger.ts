/**
 * Centralized logger — no-ops in production to prevent leaking internals.
 * Use this instead of console.log/console.error everywhere.
 */
const isDev = import.meta.env.DEV;

export const logger = {
    log: isDev ? console.log.bind(console) : () => {},
    warn: isDev ? console.warn.bind(console) : () => {},
    error: isDev
        ? console.error.bind(console)
        : (...args: unknown[]) => {
              // In production: you could send to a monitoring service like Sentry here
              // Example: Sentry.captureException(args[0]);
          },
    info: isDev ? console.info.bind(console) : () => {},
};
