// Only trusted local preflight code may defer an execution. JSON/provider error
// properties cannot forge membership in this process-local set.
const deferred = new WeakSet();
export function deferNicepayExecution(message, cause) {
  const error = new Error(message, { cause });
  deferred.add(error);
  return error;
}
export function isNicepayExecutionDeferred(error) {
  return error !== null && typeof error === 'object' && deferred.has(error);
}
