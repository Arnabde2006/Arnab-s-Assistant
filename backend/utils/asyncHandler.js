// Express 4 does not catch rejected promises thrown inside async route
// handlers — an unhandled rejection there can crash the whole Node process
// (killing the server for every user), not just fail the one request.
// Wrap every route handler with this so errors are always passed to
// Express's error-handling middleware instead.
export function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
