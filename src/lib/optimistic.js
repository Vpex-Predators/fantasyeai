// Helpers for actions that show their pending state immediately: every
// background request is bounded, and failures report a readable message so the
// caller can roll back its snapshot and raise a toast.

export const TIMEOUTS = {
  scan: 90000,
  refresh: 30000,
  analyze: 90000,
};

export function withTimeout(promise, ms, message = "The request took too long.") {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export function errorText(error, fallback = "Something went wrong.") {
  return error?.response?.data?.error || error?.message || fallback;
}