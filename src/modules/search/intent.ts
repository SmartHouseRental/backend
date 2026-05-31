import type { ParsedFilters } from './filters';
import type { SupportedCurrency } from './currency';
import { extractPriceBounds } from './pricePhrases';

/** Explicit budget language: less/under/greater/between + amount. */
export function detectHardPriceConstraint(query: string): boolean {
  const bounds = extractPriceBounds(query);
  return bounds.hasExplicitComparator && (bounds.minPrice != null || bounds.maxPrice != null);
}

export function hasExplicitPriceConstraint(query: string): boolean {
  const bounds = extractPriceBounds(query);
  return bounds.hasExplicitComparator || bounds.minPrice != null || bounds.maxPrice != null;
}

/** Locks min/max from the raw query — overrides Gemini/keyword defaults. */
export function enforcePriceIntentFromQuery(query: string, filters: ParsedFilters): ParsedFilters {
  const bounds = extractPriceBounds(query);
  const hardPriceConstraint = detectHardPriceConstraint(query);
  const next = { ...filters, hardPriceConstraint };

  if (hardPriceConstraint || bounds.hasExplicitComparator) {
    if (bounds.minPrice != null) next.minPrice = bounds.minPrice;
    if (bounds.maxPrice != null) next.maxPrice = bounds.maxPrice;
    next.priceCurrency = bounds.priceCurrency;
  } else if (bounds.maxPrice != null && next.maxPrice == null) {
    next.maxPrice = bounds.maxPrice;
    next.priceCurrency = bounds.priceCurrency;
  }

  return next;
}

export function hasAnyPriceFilter(filters: ParsedFilters): boolean {
  return filters.minPrice != null || filters.maxPrice != null;
}

function priceToEtb(value: number, currency: SupportedCurrency, etbPerUsd: number): number {
  return currency === 'USD' ? Math.round(value * etbPerUsd) : Math.round(value);
}

/**
 * Target rent in ETB for price_relevance_score ranking.
 * max-only → target is ceiling; min-only → floor; range → midpoint.
 */
export function getTargetPriceEtb(filters: ParsedFilters, etbPerUsd: number): number | null {
  const { minPrice, maxPrice, priceCurrency } = filters;

  if (maxPrice != null && minPrice != null) {
    return Math.round(
      (priceToEtb(minPrice, priceCurrency, etbPerUsd) +
        priceToEtb(maxPrice, priceCurrency, etbPerUsd)) /
        2,
    );
  }
  if (maxPrice != null) {
    return priceToEtb(maxPrice, priceCurrency, etbPerUsd);
  }
  if (minPrice != null) {
    return priceToEtb(minPrice, priceCurrency, etbPerUsd);
  }
  return null;
}
