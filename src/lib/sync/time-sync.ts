/**
 * NTP-style time synchronization
 * Calculates the offset between client and server clocks
 */

interface TimeSyncResult {
  serverTime: number;
  roundTripTime: number;
  offset: number;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

/**
 * Measure the time offset between client and server
 */
export async function measureTimeOffset(): Promise<TimeSyncResult> {
  const t1 = Date.now();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-heartbeat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const t4 = Date.now();
  const { server_time } = await response.json();

  const roundTripTime = t4 - t1;
  // Assume symmetric latency: server received at t1 + RTT/2
  const estimatedServerTime = server_time + roundTripTime / 2;
  const offset = t4 - estimatedServerTime;

  return {
    serverTime: estimatedServerTime,
    roundTripTime,
    offset,
  };
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Take multiple samples and return median offset for accuracy
 */
export async function calibrateTimeOffset(samples: number = 5): Promise<number> {
  const offsets: number[] = [];

  for (let i = 0; i < samples; i++) {
    try {
      const result = await measureTimeOffset();
      offsets.push(result.offset);
      if (i < samples - 1) {
        await sleep(100);
      }
    } catch (error) {
      console.warn("Time sync sample failed:", error);
    }
  }

  if (offsets.length === 0) {
    console.warn("All time sync samples failed, using 0 offset");
    return 0;
  }

  // Use median to filter outliers
  offsets.sort((a, b) => a - b);
  return offsets[Math.floor(offsets.length / 2)];
}

/**
 * Get current server time estimate
 */
export function getServerTime(offset: number): number {
  return Date.now() - offset;
}
