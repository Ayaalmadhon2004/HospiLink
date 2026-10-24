// Lets the API layer report a 401 without importing React: AuthProvider registers the handler.
type Handler = () => void;

let handler: Handler | null = null;

/** Registers the single session-expired handler; returns the function that unregisters it. */
export const setSessionExpiredHandler = (next: Handler): (() => void) => {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
};

export const notifySessionExpired = (): void => handler?.();
