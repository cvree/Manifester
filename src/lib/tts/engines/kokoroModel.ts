/**
 * The model version the browser, the backend and the build script all key
 * against by default.
 *
 * It has to be one constant in one file because a cache key is only useful if
 * everybody computes the same one. If the page thought it was talking to
 * `v1.0` and the server named its files `v1`, every clip would be synthesised
 * by the server, stored under a name the page never asks for, and synthesised
 * again on the next visit — a cache that is perfectly consistent and never
 * hits.
 *
 * A deployment running a different checkpoint says so on `/health`, and the
 * page adopts that value before it computes any keys.
 */
export const KOKORO_MODEL_VERSION = 'kokoro-82m-v1.0'
