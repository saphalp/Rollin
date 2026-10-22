// Common passenger-vehicle makes sold in the US. Not exhaustive — this is a
// college ride-share app, not a DMV registry.
export const VEHICLE_MAKES = [
  'Acura', 'Audi', 'BMW', 'Buick', 'Cadillac', 'Chevrolet', 'Chrysler', 'Dodge',
  'Fiat', 'Ford', 'GMC', 'Genesis', 'Honda', 'Hyundai', 'Infiniti', 'Jaguar',
  'Jeep', 'Kia', 'Land Rover', 'Lexus', 'Lincoln', 'Mazda', 'Mercedes-Benz',
  'Mini', 'Mitsubishi', 'Nissan', 'Porsche', 'Ram', 'Subaru', 'Tesla', 'Toyota',
  'Volkswagen', 'Volvo',
];

// Descending so recent model years (the common case) are at the top of the list.
export function vehicleYearOptions(): string[] {
  const latest = new Date().getFullYear() + 1;
  const years: string[] = [];
  for (let year = latest; year >= 1900; year--) {
    years.push(String(year));
  }
  return years;
}

type NhtsaModelsResponse = {
  Results?: { Model_Name?: string }[];
};

// NHTSA's free, keyless vPIC API — avoids hand-maintaining a make→model
// mapping, which would be large and quickly out of date.
export async function fetchVehicleModels(make: string): Promise<string[]> {
  const response = await fetch(
    `https://vpic.nhtsa.dot.gov/api/vehicles/getmodelsformake/${encodeURIComponent(make)}?format=json`,
  );

  if (!response.ok) {
    throw new Error('Unable to load vehicle models. Please try again.');
  }

  const data = (await response.json()) as NhtsaModelsResponse;
  const names = (data.Results ?? [])
    .map((result) => result.Model_Name)
    .filter((name): name is string => Boolean(name));

  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}
