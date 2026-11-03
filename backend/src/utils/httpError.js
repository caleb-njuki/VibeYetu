// Makes an error that the app's error handler turns into a clean JSON reply.
export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
