import { sanitizeParsedFilters } from './queryParser';
import { buildRentAmountEtbSql, type SupportedCurrency } from './currency';
import { categoryLabelForPropertyType } from './propertyTypes';
import { enforcePriceIntentFromQuery } from './intent';

export type { SupportedCurrency };

export type PropertyTypeFilter =
  | 'apartment'
  | 'villa'
  | 'studio'
  | 'house'
  | 'penthouse'
  | 'condo'
  | 'shared room'
  | 'serviced apartment';

/**
 * Structured filters from the Smart House Rental query parser.
 * Price filters use ETB-equivalent rent unless priceCurrency is USD.
 */
export interface ParsedFilters {
  location: string | null;
  bedrooms: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  priceCurrency: SupportedCurrency;
  currency: SupportedCurrency;
  amenities: string[];
  propertyType: PropertyTypeFilter | null;
  keywords: string[];
  confidence: number;
  /** True when query uses explicit budget comparators (less/under/greater/between). */
  hardPriceConstraint: boolean;
}

function hasValue<T>(v: T | null | undefined): v is T {
  return v !== null && v !== undefined;
}

export function hasStructuredFilters(filters: ParsedFilters): boolean {
  return (
    hasValue(filters.location) ||
    hasValue(filters.maxPrice) ||
    hasValue(filters.minPrice) ||
    filters.bedrooms != null ||
    filters.amenities.length > 0 ||
    hasValue(filters.propertyType)
  );
}

/** Re-run sanitization + lock explicit price intent from raw query. */
export function finalizeParsedFilters(query: string, filters: ParsedFilters): ParsedFilters {
  const sanitized = sanitizeParsedFilters(filters, query, filters.currency);
  return enforcePriceIntentFromQuery(query, {
    ...sanitized,
    hardPriceConstraint: filters.hardPriceConstraint ?? sanitized.hardPriceConstraint,
  });
}

export type SearchMatchMode = 'strict' | 'relaxed' | 'semantic';

/**
 * Progressive relaxations when strict filters return no rows.
 * Price bounds are NEVER dropped — hard pre-vector constraint only.
 */
export function buildFilterRelaxationLadder(filters: ParsedFilters): ParsedFilters[] {
  const ladder: ParsedFilters[] = [];
  let current = { ...filters };

  const pushIfChanged = (next: ParsedFilters) => {
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      ladder.push(next);
      current = next;
    }
  };

  if (current.propertyType) {
    pushIfChanged({ ...current, propertyType: null });
  }
  if (current.amenities.length > 0) {
    pushIfChanged({ ...current, amenities: [] });
  }
  if (current.location) {
    pushIfChanged({ ...current, location: null });
  }
  if (current.bedrooms != null) {
    pushIfChanged({ ...current, bedrooms: null });
  }

  return ladder;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

function sqlLikeLiteral(value: string): string {
  return `'%${escapeLikePattern(value)}%'`;
}

function sqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Builds SQL AND clauses for hybrid search pre-filtering (runs BEFORE vector ranking).
 * Price filters are mandatory when present — no post-vector override.
 */
export function buildFilterSql(filters: ParsedFilters, etbPerUsd: number): string {
  let filterSql = '';
  const rentEtb = buildRentAmountEtbSql(etbPerUsd);

  if (hasValue(filters.maxPrice)) {
    const max = Number(filters.maxPrice);
    if (filters.priceCurrency === 'USD') {
      filterSql += ` AND (
        (UPPER(COALESCE(p.price->>'currency', 'ETB')) = 'USD' AND (p.price->>'value')::numeric <= ${max})
        OR
        (UPPER(COALESCE(p.price->>'currency', 'ETB')) <> 'USD' AND ${rentEtb} <= ${Math.round(max * etbPerUsd)})
      )`;
    } else {
      filterSql += ` AND ${rentEtb} <= ${max}`;
    }
  }

  if (hasValue(filters.minPrice)) {
    const min = Number(filters.minPrice);
    if (filters.priceCurrency === 'USD') {
      filterSql += ` AND (
        (UPPER(COALESCE(p.price->>'currency', 'ETB')) = 'USD' AND (p.price->>'value')::numeric >= ${min})
        OR
        (UPPER(COALESCE(p.price->>'currency', 'ETB')) <> 'USD' AND ${rentEtb} >= ${Math.round(min * etbPerUsd)})
      )`;
    } else {
      filterSql += ` AND ${rentEtb} >= ${min}`;
    }
  }

  if (filters.bedrooms != null) {
    if (filters.bedrooms === 0 || filters.propertyType === 'studio') {
      filterSql += ` AND (p.bedrooms = 0 OR LOWER(TRIM(p.category->>'en')) = 'studio')`;
    } else {
      filterSql += ` AND p.bedrooms >= ${Number(filters.bedrooms)}`;
    }
  }

  if (hasValue(filters.propertyType) && filters.bedrooms !== 0) {
    const label = categoryLabelForPropertyType(filters.propertyType);
    filterSql += ` AND LOWER(TRIM(p.category->>'en')) = ${sqlStringLiteral(label)}`;
  }

  if (hasValue(filters.location)) {
    const loc = sqlLikeLiteral(filters.location);
    filterSql += ` AND (
      p.location::text ILIKE ${loc} OR
      p.address::text ILIKE ${loc} OR
      p.title::text ILIKE ${loc}
    )`;
  }

  for (const amenity of filters.amenities) {
    const pattern = sqlLikeLiteral(amenity);
    filterSql += ` AND p.amenities::text ILIKE ${pattern}`;
  }

  return filterSql;
}

export function describeFilterSql(filters: ParsedFilters, etbPerUsd: number): string {
  const sql = buildFilterSql(filters, etbPerUsd);
  return sql.trim() ? sql.trim() : '(no structured filters — vector only)';
}
