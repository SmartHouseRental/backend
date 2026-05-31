import type { ParsedFilters, PropertyTypeFilter } from './filters';
import type { SupportedCurrency } from './currency';
import { PROPERTY_TYPE_PARSE_ORDER } from './propertyTypes';
import { detectPriceCurrency, extractPriceBounds } from './pricePhrases';
import { detectHardPriceConstraint, enforcePriceIntentFromQuery } from './intent';

export const ALLOWED_AMENITIES = [
  'gym',
  'parking',
  'wifi',
  'furnished',
  'balcony',
  'security',
  'elevator',
] as const;

const KEYWORD_VOCAB = [
  'modern',
  'cheap',
  'spacious',
  'new',
  'luxury',
  'affordable',
  'cozy',
  'bright',
  'student',
] as const;

const BEDROOM_PATTERN = /\b(\d+)\s*(?:bed(?:room)?s?|br)\b/i;
/** Colloquial housing request — not property category "House" */
const GENERIC_HOUSE_PHRASE =
  /\b(?:need|want|looking for|searching for|find|get)\s+(?:(?:a|the|cheap|affordable|nice|good|decent|small|big)\s+){0,4}house\b/i;
const NEAR_LOCATION_PATTERN = /\b(?:near|in|around|at)\s+([a-z][a-z\s-]{1,40})/i;

const KNOWN_LOCATIONS = [
  'Addis Ababa',
  'Hawassa',
  'Adama',
  'Bole Medhanialem',
  'Bole Adama',
  'Bole',
  'Kazanchis',
  'Piassa',
  'Mexico Square',
  'Summit',
  'Saris',
  'Bisrate Gabriel',
  'Megenagna',
  'CMC',
  'Gerji',
  'Ayat',
  'Hayat',
  'Arat Kilo',
  'Piazza',
  'Lideta',
  'Kirkos',
  'Arada',
  'Yeka',
  'Gullele',
  'Kolfe',
  'Akaky Kaliti',
  'Nifas Silk-Lafto',
  'Old Airport',
  'Tabor',
] as const;

const AMENITY_ALIASES: Record<string, (typeof ALLOWED_AMENITIES)[number]> = {
  gym: 'gym',
  parking: 'parking',
  wifi: 'wifi',
  'wi-fi': 'wifi',
  furnished: 'furnished',
  balcony: 'balcony',
  security: 'security',
  elevator: 'elevator',
  lift: 'elevator',
};

const PROPERTY_TYPE_SET = new Set<string>([
  'apartment',
  'villa',
  'studio',
  'house',
  'penthouse',
  'condo',
  'shared room',
  'serviced apartment',
]);

function parseNumberToken(raw: string): number | null {
  const value = Number(raw.replace(/,/g, ''));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function applyPriceRulesFromText(query: string, filters: ParsedFilters): void {
  const lower = query.toLowerCase();
  const bounds = extractPriceBounds(query);

  if (bounds.minPrice != null) filters.minPrice = bounds.minPrice;
  if (bounds.maxPrice != null) filters.maxPrice = bounds.maxPrice;
  filters.priceCurrency = bounds.priceCurrency;

  if (!bounds.hasExplicitComparator) {
    if (/\bmid[- ]?range\b/i.test(lower) && filters.maxPrice == null) {
      filters.maxPrice = 100_000;
      filters.priceCurrency = 'ETB';
    }
    if (/\baffordable\b/i.test(lower) && filters.maxPrice == null) {
      filters.maxPrice = 60_000;
      filters.priceCurrency = 'ETB';
    }
    if (/\bcheap\b/i.test(lower) && filters.maxPrice == null) {
      filters.maxPrice = bounds.priceCurrency === 'USD' ? 800 : 40_000;
      filters.priceCurrency = bounds.priceCurrency === 'USD' ? 'USD' : 'ETB';
    }
    if (/\bluxury\b/i.test(lower) && filters.minPrice == null) {
      filters.minPrice = bounds.priceCurrency === 'USD' ? 2_000 : 120_000;
      filters.priceCurrency = bounds.priceCurrency === 'USD' ? 'USD' : 'ETB';
    }
  }

  if (/\bstudent(s)?\b/i.test(lower)) {
    if (!filters.keywords.includes('student')) {
      filters.keywords = [...filters.keywords, 'student'];
    }
    if (filters.maxPrice == null && filters.minPrice == null) {
      filters.maxPrice = 40_000;
      filters.priceCurrency = 'ETB';
    }
  }
}

function extractKeywords(query: string): string[] {
  const lower = query.toLowerCase();
  const found = new Set<string>();

  for (const word of KEYWORD_VOCAB) {
    if (lower.includes(word)) {
      found.add(word);
    }
  }

  return [...found];
}

function parsePropertyTypeFromQuery(query: string): PropertyTypeFilter | null {
  if (GENERIC_HOUSE_PHRASE.test(query)) {
    return null;
  }

  for (const { pattern, type } of PROPERTY_TYPE_PARSE_ORDER) {
    if (pattern.test(query)) {
      return type;
    }
  }
  return null;
}

export function computeConfidence(filters: ParsedFilters, query: string): number {
  let score = 0;

  if (filters.location) score += 0.3;
  if (filters.bedrooms != null) score += 0.2;
  if (filters.maxPrice != null || filters.minPrice != null) score += 0.2;
  if (filters.amenities.length > 0) score += 0.2;

  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length >= 3) score += 0.1;

  return Math.min(1, Math.round(score * 100) / 100);
}

export function sanitizeParsedFilters(
  raw: Partial<ParsedFilters>,
  query: string,
  displayCurrency: SupportedCurrency = 'ETB',
): ParsedFilters {
  const amenities = Array.isArray(raw.amenities)
    ? raw.amenities
        .map((a) => String(a).trim().toLowerCase())
        .filter((a): a is (typeof ALLOWED_AMENITIES)[number] =>
          (ALLOWED_AMENITIES as readonly string[]).includes(a),
        )
    : [];

  let propertyType: ParsedFilters['propertyType'] = null;
  if (raw.propertyType) {
    const normalized = String(raw.propertyType).trim().toLowerCase();
    if (PROPERTY_TYPE_SET.has(normalized)) {
      propertyType = normalized as PropertyTypeFilter;
    }
  }

  const filters: ParsedFilters = {
    location: raw.location?.trim() || null,
    bedrooms: raw.bedrooms != null ? Number(raw.bedrooms) : null,
    minPrice: raw.minPrice != null ? Number(raw.minPrice) : null,
    maxPrice: raw.maxPrice != null ? Number(raw.maxPrice) : null,
    priceCurrency: raw.priceCurrency === 'USD' ? 'USD' : 'ETB',
    currency: displayCurrency,
    amenities,
    propertyType,
    keywords: Array.isArray(raw.keywords)
      ? raw.keywords.map((k) => String(k).trim().toLowerCase()).filter(Boolean)
      : [],
    confidence:
      typeof raw.confidence === 'number' && raw.confidence >= 0 && raw.confidence <= 1
        ? Math.round(raw.confidence * 100) / 100
        : 0,
    hardPriceConstraint: raw.hardPriceConstraint ?? false,
  };

  if (Number.isNaN(filters.bedrooms as number)) filters.bedrooms = null;
  if (Number.isNaN(filters.minPrice as number)) filters.minPrice = null;
  if (Number.isNaN(filters.maxPrice as number)) filters.maxPrice = null;

  if (!query) return filters;

  applyPriceRulesFromText(query, filters);

  if (!filters.propertyType) {
    filters.propertyType = parsePropertyTypeFromQuery(query);
  }

  if (!filters.keywords.length) {
    filters.keywords = extractKeywords(query);
  } else {
    const extra = extractKeywords(query);
    filters.keywords = [...new Set([...filters.keywords, ...extra])];
  }

  if (filters.confidence === 0) {
    filters.confidence = computeConfidence(filters, query);
  }

  return enforcePriceIntentFromQuery(query, filters);
}

export function parseQueryLocally(
  query: string,
  displayCurrency: SupportedCurrency = 'ETB',
): ParsedFilters {
  const q = query.trim();
  const lower = q.toLowerCase();

  const filters: ParsedFilters = {
    location: null,
    bedrooms: null,
    minPrice: null,
    maxPrice: null,
    priceCurrency: detectPriceCurrency(q),
    currency: displayCurrency,
    amenities: [],
    propertyType: null,
    keywords: [],
    confidence: 0,
    hardPriceConstraint: detectHardPriceConstraint(q),
  };

  const bedroomMatch = q.match(BEDROOM_PATTERN);
  if (bedroomMatch) {
    filters.bedrooms = parseNumberToken(bedroomMatch[1]);
  }

  if (/\bstudio\b/i.test(lower)) {
    filters.propertyType = 'studio';
    if (filters.bedrooms == null) {
      filters.bedrooms = 0;
    }
  } else {
    filters.propertyType = parsePropertyTypeFromQuery(q);
  }

  const amenitySet = new Set<(typeof ALLOWED_AMENITIES)[number]>();
  for (const [alias, canonical] of Object.entries(AMENITY_ALIASES)) {
    if (lower.includes(alias)) {
      amenitySet.add(canonical);
    }
  }
  filters.amenities = [...amenitySet];

  const sortedLocations = [...KNOWN_LOCATIONS].sort((a, b) => b.length - a.length);
  for (const area of sortedLocations) {
    if (lower.includes(area.toLowerCase())) {
      filters.location = area;
      break;
    }
  }

  if (!filters.location) {
    const nearMatch = q.match(NEAR_LOCATION_PATTERN);
    if (nearMatch) {
      const candidate = nearMatch[1]
        .replace(/\b(with|and|having|that|under|below)\b.*$/i, '')
        .trim();
      if (candidate.length >= 2) {
        filters.location = candidate
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
      }
    }
  }

  filters.keywords = extractKeywords(q);
  applyPriceRulesFromText(q, filters);
  filters.confidence = computeConfidence(filters, q);

  return enforcePriceIntentFromQuery(q, filters);
}

export function mergeParsedFilters(
  primary: ParsedFilters,
  fallback: ParsedFilters,
  query: string,
  displayCurrency: SupportedCurrency = 'ETB',
): ParsedFilters {
  const merged = sanitizeParsedFilters(
    {
      location: primary.location?.trim() || fallback.location || null,
      bedrooms: primary.bedrooms ?? fallback.bedrooms ?? null,
      minPrice: primary.minPrice ?? fallback.minPrice ?? null,
      maxPrice: primary.maxPrice ?? fallback.maxPrice ?? null,
      priceCurrency: primary.priceCurrency || fallback.priceCurrency,
      currency: displayCurrency,
      amenities: primary.amenities.length > 0 ? primary.amenities : fallback.amenities,
      propertyType: primary.propertyType ?? fallback.propertyType ?? null,
      keywords: primary.keywords.length > 0 ? primary.keywords : fallback.keywords,
      confidence: primary.confidence > 0 ? primary.confidence : fallback.confidence,
      hardPriceConstraint: primary.hardPriceConstraint || fallback.hardPriceConstraint,
    },
    query,
    displayCurrency,
  );

  merged.confidence = computeConfidence(merged, query);
  return enforcePriceIntentFromQuery(query, merged);
}
