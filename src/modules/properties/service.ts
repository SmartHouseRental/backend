import prisma from '../../config/database';
import { CreatePropertyInput, GetPropertiesQueryInput, UpdatePropertyInput } from './schema';
import { PropertyStatus } from '@prisma/client';

const SUPPORTED_LANGUAGES = new Set(['en', 'am']);

function toRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, v]) => typeof v === 'string'
  ) as Array<[string, string]>;
  return Object.fromEntries(entries);
}

function localizeText(value: unknown, language: string): string {
  const map = toRecord(value);
  if (map[language]) return map[language];
  if (map.en) return map.en;
  const first = Object.values(map)[0];
  return typeof first === 'string' ? first : '';
}

function localizeProperty<T extends { title: unknown; description: unknown }>(
  property: T,
  language: string
) {
  return {
    ...property,
    titleText: localizeText(property.title, language),
    descriptionText: localizeText(property.description, language),
    language,
  };
}

const TYPE_LABELS: Record<string, { en: string; am: string }> = {
  VILLA: { en: 'Villa', am: 'ቪላ' },
  APARTMENT: { en: 'Apartment', am: 'አፓርታማ' },
  CONDO: { en: 'Condo', am: 'ኮንዶ' },
  STUDIO: { en: 'Studio', am: 'ስቱዲዮ' },
  HOUSE: { en: 'House', am: 'ቤት' },
  PENTHOUSE: { en: 'Penthouse', am: 'ፔንትሃውስ' },
};

function formatPropertyResponse(property: any) {
  const titleMap = toRecord(property.title);
  const descriptionMap = toRecord(property.description);
  const rentTerms = (property.rentTerms as any) || {};

  const typeLabel = TYPE_LABELS[property.type] ?? {
    en: property.type ?? '',
    am: property.type ?? '',
  };

  return {
    id: property.id,
    type: typeLabel,
    title: titleMap,
    description: descriptionMap,
    address: { en: property.address ?? '', am: property.address ?? '' },
    price: { value: property.price ?? null, currency: rentTerms.currency ?? 'ETB' },
    area: { value: property.area ?? null, unit: 'sqm' },
    leaseTerms: {
      minDuration: rentTerms.minMonths
        ? String(rentTerms.minMonths)
        : rentTerms.minDuration
          ? String(rentTerms.minDuration)
          : undefined,
      secureDeposit: rentTerms.secureDeposit
        ? { value: rentTerms.secureDeposit, currency: rentTerms.currency ?? 'ETB' }
        : undefined,
      conditions: {
        en: descriptionMap.en ?? '',
        am: descriptionMap.am ?? '',
      },
    },
    images: property.images ?? [],
    video: Array.isArray(property.videos) && property.videos.length > 0 ? property.videos[0] : '',
    availableFrom:
      property.availableFrom ??
      (property.createdAt ? property.createdAt.toISOString().slice(0, 10) : null),
    status: property.status,
    owner: property.owner ?? null,
    createdAt: property.createdAt,
  };
}

export const propertyService = {
  async createProperty(ownerId: string, data: CreatePropertyInput) {
    return await prisma.property.create({
      data: {
        owner: {
          connect: { id: ownerId },
        },
        // 🔥 Use foreign key directly (simpler & safer)

        type: data.type,
        title: data.title,
        description: data.description,
        location: data.location,
        address: data.address ?? null,
        price: data.price,
        bedrooms: data.bedrooms ?? null,
        bathrooms: data.bathrooms ?? null,
        area: data.area ?? null,
        amenities: data.amenities ?? {},
        furnishingType: data.furnishingType ?? null,
        images: data.images,
        videos: data.videos ?? [],
        rentTerms: data.rentTerms ?? null,
      },
    });
  },

  async getProperties(query: GetPropertiesQueryInput, language = 'en') {
    const raw = (query ?? {}) as Record<string, unknown>;
    const toNumber = (value: unknown): number | undefined => {
      if (value === undefined || value === null || value === '') return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    const page = Math.max(1, Math.trunc(toNumber(raw.page) ?? 1));
    const limit = Math.min(50, Math.max(1, Math.trunc(toNumber(raw.limit) ?? 12)));

    const status = typeof raw.status === 'string' ? raw.status : undefined;
    const type = typeof raw.type === 'string' ? raw.type : undefined;

    const minPrice = toNumber(raw.minPrice);
    const maxPrice = toNumber(raw.maxPrice);
    const bedrooms = toNumber(raw.bedrooms);
    const bathrooms = toNumber(raw.bathrooms);

    const allowedSortBy = new Set(['createdAt', 'price', 'viewsCount']);
    const sortBy =
      typeof raw.sortBy === 'string' && allowedSortBy.has(raw.sortBy) ? raw.sortBy : 'createdAt';

    const order = raw.order === 'asc' || raw.order === 'desc' ? raw.order : 'desc';

    const skip = (page - 1) * limit;

    const where: any = {
      isDeleted: false,
    };

    if (status) where.status = status;
    if (type) where.type = type;

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    if (bedrooms !== undefined) where.bedrooms = bedrooms;
    if (bathrooms !== undefined) where.bathrooms = bathrooms;

    const normalizedLanguage = SUPPORTED_LANGUAGES.has(language) ? language : 'en';

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: {
          owner: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      }),
      prisma.property.count({ where }),
    ]);

    return {
      properties: properties.map((property) => formatPropertyResponse(property)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getPropertyById(propertyId: string, language = 'en') {
    const normalizedLanguage = SUPPORTED_LANGUAGES.has(language) ? language : 'en';
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        isDeleted: false,
      },
      include: {
        owner: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    if (!property) return null;
    return formatPropertyResponse(property);
  },

  async updateProperty(ownerId: string, propertyId: string, data: UpdatePropertyInput) {
    const existing = await prisma.property.findFirst({
      where: { id: propertyId, isDeleted: false },
    });

    if (!existing) return null;
    if (existing.ownerId !== ownerId) return 'UNAUTHORIZED';

    return await prisma.property.update({
      where: { id: propertyId },
      data,
    });
  },

  async softDeleteProperty(ownerId: string, propertyId: string) {
    const existing = await prisma.property.findFirst({
      where: { id: propertyId, isDeleted: false },
    });

    if (!existing) return null;
    if (existing.ownerId !== ownerId) return 'UNAUTHORIZED';

    return await prisma.property.update({
      where: { id: propertyId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  },

  async getMyProperties(ownerId: string) {
    const properties = await prisma.property.findMany({
      where: {
        ownerId,
        isDeleted: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return properties.map((property) => localizeProperty(property, 'en'));
  },

  async updatePropertyStatus(ownerId: string, propertyId: string, status: PropertyStatus) {
    const existing = await prisma.property.findFirst({
      where: { id: propertyId, isDeleted: false },
    });

    if (!existing) return null;
    if (existing.ownerId !== ownerId) return 'UNAUTHORIZED';

    return await prisma.property.update({
      where: { id: propertyId },
      data: { status },
    });
  },

  async upsertPropertyTranslation(
    ownerId: string,
    propertyId: string,
    language: 'en' | 'am',
    title: string,
    description: string
  ) {
    const existing = await prisma.property.findFirst({
      where: { id: propertyId, isDeleted: false },
      select: { ownerId: true, title: true, description: true },
    });

    if (!existing) return null;
    if (existing.ownerId !== ownerId) return 'UNAUTHORIZED';

    const titleMap = toRecord(existing.title);
    const descriptionMap = toRecord(existing.description);

    titleMap[language] = title;
    descriptionMap[language] = description;

    return await prisma.property.update({
      where: { id: propertyId },
      data: {
        title: titleMap,
        description: descriptionMap,
      },
    });
  },

  async updatePropertyTranslation(
    ownerId: string,
    propertyId: string,
    language: 'en' | 'am',
    title: string,
    description: string
  ) {
    const existing = await prisma.property.findFirst({
      where: { id: propertyId, isDeleted: false },
      select: { ownerId: true, title: true, description: true },
    });

    if (!existing) return null;
    if (existing.ownerId !== ownerId) return 'UNAUTHORIZED';

    const titleMap = toRecord(existing.title);
    const descriptionMap = toRecord(existing.description);
    if (!titleMap[language] || !descriptionMap[language]) return 'NOT_FOUND';

    titleMap[language] = title;
    descriptionMap[language] = description;

    return await prisma.property.update({
      where: { id: propertyId },
      data: {
        title: titleMap,
        description: descriptionMap,
      },
    });
  },

  async deletePropertyTranslation(ownerId: string, propertyId: string, language: 'en' | 'am') {
    if (language === 'en') return 'CANNOT_DELETE_ENGLISH';

    const existing = await prisma.property.findFirst({
      where: { id: propertyId, isDeleted: false },
      select: { ownerId: true, title: true, description: true },
    });

    if (!existing) return null;
    if (existing.ownerId !== ownerId) return 'UNAUTHORIZED';

    const titleMap = toRecord(existing.title);
    const descriptionMap = toRecord(existing.description);

    if (!titleMap[language] && !descriptionMap[language]) return 'NOT_FOUND';

    delete titleMap[language];
    delete descriptionMap[language];

    return await prisma.property.update({
      where: { id: propertyId },
      data: {
        title: titleMap,
        description: descriptionMap,
      },
    });
  },
  async trackPropertyView(propertyId: string, userId: string) {
    if (!userId) return;

    const existingView = await prisma.userInteraction.findFirst({
      where: {
        propertyId,
        type: 'VIEW',
        userId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    if (existingView) return;

    await prisma.userInteraction.create({
      data: {
        propertyId,
        userId,
        type: 'VIEW',
      },
    });

    await prisma.property.update({
      where: { id: propertyId },
      data: {
        viewsCount: { increment: 1 },
      },
    });
  },

  /**
   * Increment view count for ALL visitors (authenticated or not)
   * This ensures the view count works for anonymous users too
   */
  async incrementViewCount(propertyId: string) {
    await prisma.property.update({
      where: { id: propertyId },
      data: {
        viewsCount: { increment: 1 },
      },
    });
  },

  /**
   * Get analytics for a specific owner's properties
   * Returns: Total Properties, Available, Rented, Total Views
   */
  async getOwnerPropertyAnalytics(ownerId: string) {
    // Get all properties for this owner
    const properties = await prisma.property.findMany({
      where: {
        ownerId,
        isDeleted: false,
      },
      select: {
        id: true,
        status: true,
        viewsCount: true,
      },
    });

    const totalProperties = properties.length;
    const availableProperties = properties.filter((p) => p.status === 'AVAILABLE').length;
    const rentedProperties = properties.filter((p) => p.status === 'RENTED').length;
    const pendingProperties = properties.filter((p) => p.status === 'PENDING').length;
    const totalViews = properties.reduce((sum, p) => sum + (p.viewsCount || 0), 0);

    return {
      totalProperties,
      available: availableProperties,
      rented: rentedProperties,
      pending: pendingProperties,
      totalViews,
    };
  },
};
