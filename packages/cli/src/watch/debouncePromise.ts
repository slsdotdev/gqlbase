export function debouncePromise<T extends unknown[]>(
  fn: (...args: T) => Promise<void>,
  delay: number
) {
  let timeout: NodeJS.Timeout | null = null;
  let inFlight: Promise<void> | null = null;
  let pending: (() => void) | null = null;

  return function debounce(...args: T) {
    if (inFlight) {
      pending = () => {
        debounce(...args);
        pending = null;
      };
    } else {
      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(() => {
        inFlight = fn(...args)
          .catch((err) => {
            console.error("Error in debounced function:", err);
          })
          .finally(() => {
            inFlight = null;
            pending?.();
          });
      }, delay);
    }
  };
}
