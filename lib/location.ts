export type Coords = { lat: number; lng: number };

export type LocationResult =
  | { ok: true; coords: Coords }
  | { ok: false; reason: "denied" | "unavailable" | "timeout" | "unsupported" };

const TIMEOUT_MS = 5000;

/**
 * Tries to get the device's current GPS coordinates.
 * Always resolves — never throws — so callers can use it inline without try/catch.
 * Times out after 5 seconds and returns { ok: false } so save flows can proceed.
 */
export function getCurrentLocation(): Promise<LocationResult> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ ok: false, reason: "unsupported" });
      return;
    }

    let settled = false;
    const finish = (result: LocationResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    // Our own timeout — more reliable than the browser's `timeout` option.
    const timeoutId = setTimeout(() => {
      finish({ ok: false, reason: "timeout" });
    }, TIMEOUT_MS);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timeoutId);
        finish({
          ok: true,
          coords: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          },
        });
      },
      (err) => {
        clearTimeout(timeoutId);
        if (err.code === err.PERMISSION_DENIED) {
          finish({ ok: false, reason: "denied" });
        } else if (err.code === err.TIMEOUT) {
          finish({ ok: false, reason: "timeout" });
        } else {
          finish({ ok: false, reason: "unavailable" });
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30_000, // accept a fix up to 30s old to avoid re-triggering GPS
        timeout: TIMEOUT_MS,
      }
    );
  });
}