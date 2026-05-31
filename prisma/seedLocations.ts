/// <reference types="node" />
import fs from 'node:fs';
import path from 'node:path';

export const PROPERTY_SEED_LOCATION_COUNT = 300;
export const RENTER_SEED_LOCATION_COUNT = 100;

export type SeedMapLocation = {
  address: { en: string; am: string };
  lat: number;
  lng: number;
  city: string;
  subcity: string;
  neighborhood: string;
};

const CITIES = ['Addis Ababa', 'Adama', 'Bahir Dar', 'Hawassa', 'Mekelle'] as const;

const ADDIS_SUBCITIES = [
  'Kirkos',
  'Bole',
  'Yeka',
  'Lideta',
  'Kolfe Keranio',
  'Arada',
  'Nefas Silk',
  'Nifas Silk-Lafto',
  'Gulale',
  'Addis Ketema',
  'Akaky Kaliti',
  'Lemi Kura',
] as const;

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Parses a map-sourced address line into structured seed location fields.
 */
export function parseMapAddress(fullAddress: string, lat: number, lng: number): SeedMapLocation {
  const parts = fullAddress
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const filtered = parts.filter((part) => part !== 'Ethiopia' && !/^\d{3,5}$/.test(part));

  const city =
    [...filtered].reverse().find((part) => CITIES.some((knownCity) => part.includes(knownCity))) ??
    'Addis Ababa';

  const subcity =
    filtered.find((part) => ADDIS_SUBCITIES.some((known) => part === known || part.startsWith(known))) ??
    filtered[Math.max(0, filtered.indexOf(city) - 1)] ??
    city;

  const neighborhood = filtered[0] ?? subcity;

  return {
    address: { en: fullAddress, am: fullAddress },
    lat: roundTo(lat, 6),
    lng: roundTo(lng, 6),
    city,
    subcity,
    neighborhood,
  };
}

/**
 * Loads and parses all map locations from `backend/docs/location.md`.
 */
export function loadSeedMapLocations(): SeedMapLocation[] {
  const filePath = path.join(__dirname, '..', '..', 'docs', 'location.md');
  const text = fs.readFileSync(filePath, 'utf8');
  const pattern = /^(.+)\nCoordinates:\s*([-\d.]+),\s*([-\d.]+)/gm;
  const locations: SeedMapLocation[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null = pattern.exec(text);
  while (match) {
    const fullAddress = match[1].trim();
    const lat = Number(match[2]);
    const lng = Number(match[3]);
    const key = `${fullAddress}|${lat}|${lng}`;

    if (!seen.has(key)) {
      seen.add(key);
      locations.push(parseMapAddress(fullAddress, lat, lng));
    }

    match = pattern.exec(text);
  }

  const required = PROPERTY_SEED_LOCATION_COUNT + RENTER_SEED_LOCATION_COUNT;
  if (locations.length < required) {
    throw new Error(
      `location.md must contain at least ${required} unique address/coordinate pairs; found ${locations.length}.`
    );
  }

  return locations;
}

export const SEED_MAP_LOCATIONS = loadSeedMapLocations();

export function getPropertyMapLocation(index: number): SeedMapLocation {
  if (index < 0 || index >= PROPERTY_SEED_LOCATION_COUNT) {
    throw new Error(`Property map location index out of range: ${index}`);
  }
  return SEED_MAP_LOCATIONS[index];
}

export function getRenterMapLocation(index: number): SeedMapLocation {
  const offset = PROPERTY_SEED_LOCATION_COUNT + index;
  if (index < 0 || index >= RENTER_SEED_LOCATION_COUNT) {
    throw new Error(`Renter map location index out of range: ${index}`);
  }
  return SEED_MAP_LOCATIONS[offset];
}

export function toPropertyLocationJson(location: SeedMapLocation): {
  lat: number;
  lng: number;
  city: string;
  subcity: string;
  neighborhood: string;
} {
  return {
    lat: location.lat,
    lng: location.lng,
    city: location.city,
    subcity: location.subcity,
    neighborhood: location.neighborhood,
  };
}
