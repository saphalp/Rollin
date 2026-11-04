// One definition of when a ride is over, shared by the Rides tabs, History, and ride details.

/**
 * How long after departure a ride that was never started stays active, so a driver running
 * a little late can still tap Start Drive. After that it counts as expired.
 */
export const RIDE_START_GRACE_MS = 30 * 60 * 1000;

type RideTiming = {
  status: string;
  dateTime: string | null;
};

/** An open or full ride whose departure (plus the grace period) passed without starting. */
export function isRideExpired(ride: RideTiming, now = Date.now()): boolean {
  if (ride.status !== 'open' && ride.status !== 'full') return false;
  if (!ride.dateTime) return false;

  const departure = new Date(ride.dateTime).getTime();
  return Number.isFinite(departure) && departure + RIDE_START_GRACE_MS <= now;
}

/** Completed, cancelled, or expired: belongs in History and only allows reviews. */
export function isRideClosed(ride: RideTiming, now = Date.now()): boolean {
  return ride.status === 'completed' || ride.status === 'cancelled' || isRideExpired(ride, now);
}

/** Status to show for a closed ride; expired rides are still 'open'/'full' in the database. */
export function closedRideStatus(ride: RideTiming, now = Date.now()): string {
  return isRideExpired(ride, now) ? 'expired' : ride.status;
}

/** A posted ride request whose requested time has passed without a driver. */
export function isWantedRequestExpired(dateTime: string | null, now = Date.now()): boolean {
  if (!dateTime) return false;
  const time = new Date(dateTime).getTime();
  return Number.isFinite(time) && time <= now;
}
