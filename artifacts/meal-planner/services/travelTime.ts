const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function getDriveTimes(
  locationPairs: Array<{ from: string; to: string }>
): Promise<Array<{ from: string; to: string; minutes: number | null }>> {

  if (!GOOGLE_MAPS_API_KEY) {
    console.warn("GOOGLE_MAPS_API_KEY not set — using fallback estimates");
    return locationPairs.map((p) => ({ ...p, minutes: null }));
  }

  const uniquePairs = locationPairs.filter(
    (p) => p.from.toLowerCase().trim() !== p.to.toLowerCase().trim()
  );

  if (uniquePairs.length === 0) return [];

  const origins = uniquePairs
    .map((p) => encodeURIComponent(`${p.from}, NSW, Australia`))
    .join("|");
  const destinations = uniquePairs
    .map((p) => encodeURIComponent(`${p.to}, NSW, Australia`))
    .join("|");

  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${origins}&destinations=${destinations}&mode=driving&region=au&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = (await response.json()) as {
      status: string;
      rows: Array<{ elements: Array<{ status: string; duration: { value: number } }> }>;
    };

    if (data.status !== "OK") {
      console.warn("Distance Matrix API error:", data.status);
      return uniquePairs.map((p) => ({ ...p, minutes: 15 }));
    }

    return uniquePairs.map((pair, i) => {
      const element = data.rows[i]?.elements[i];
      if (element?.status === "OK") {
        const minutes = Math.ceil(element.duration.value / 60);
        return { ...pair, minutes };
      }
      return { ...pair, minutes: 15 };
    });
  } catch (err) {
    console.error("Distance Matrix fetch failed:", err);
    return uniquePairs.map((p) => ({ ...p, minutes: 15 }));
  }
}

export function buildTravelContext(
  driveTimes: Array<{ from: string; to: string; minutes: number | null }>
): string {
  if (driveTimes.length === 0) return "";

  const lines = driveTimes
    .filter((d) => d.minutes !== null)
    .map((d) => `${d.from} → ${d.to}: ~${d.minutes} min drive`);

  return lines.length > 0
    ? `\n\nReal-time drive estimates (Google Maps):\n${lines.join("\n")}`
    : "";
}
