/**
 * Structured text block for property vector embeddings.
 * Keeps type, beds, location, amenities, and price aligned with search filters.
 */
export function getPropertyTextRepresentation(property: Record<string, unknown>): string {
  const title =
    typeof property.title === 'string'
      ? property.title
      : (property.title as { en?: string })?.en || '';

  const description =
    typeof property.description === 'string'
      ? property.description
      : (property.description as { en?: string })?.en || '';

  const category =
    typeof property.category === 'string'
      ? property.category
      : (property.category as { en?: string })?.en || '';

  const address =
    typeof property.address === 'string'
      ? property.address
      : (property.address as { en?: string })?.en || '';

  const location = property.location as
    | { city?: string; subcity?: string; neighborhood?: string }
    | string
    | null
    | undefined;

  let locationLine = address;
  if (location && typeof location === 'object') {
    const parts = [location.neighborhood, location.subcity, location.city].filter(Boolean);
    if (parts.length > 0) {
      locationLine = parts.join(', ');
    }
  }

  const bedrooms = property.bedrooms ?? '?';
  const bathrooms = property.bathrooms ?? '?';

  let amenitiesStr = '';
  if (Array.isArray(property.amenities)) {
    amenitiesStr = property.amenities
      .map((a) => (typeof a === 'string' ? a : (a as { en?: string })?.en || ''))
      .filter(Boolean)
      .join(', ');
  }

  const price = property.price as { value?: number; currency?: string; amountEtb?: number } | null;
  let priceLine = 'Unknown';
  if (price) {
    const amountEtb = price.amountEtb ?? price.value;
    const currency = String(price.currency ?? 'ETB').toUpperCase();
    if (amountEtb != null) {
      priceLine =
        currency === 'ETB'
          ? `${Math.round(Number(amountEtb))} ETB`
          : `${price.value} ${currency} (~${Math.round(Number(amountEtb))} ETB)`;
    }
  }

  return `PROPERTY:
Type: ${category || 'Property'}
Bedrooms: ${bedrooms}
Bathrooms: ${bathrooms}
Location: ${locationLine}
Amenities: ${amenitiesStr || 'None'}
Price: ${priceLine}
Title: ${title}
Description: ${description}`;
}
