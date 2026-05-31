import prisma from '../../config/database';
import { cosineSimilarity } from '../../utils/similarity.utils';
import interactionService from '../interactions/service';

type PreferencePayload = {
  budget?: { min?: number; max?: number; currency?: string };
  bedrooms?: number | { min?: number; max?: number };
  preferredLocations?: Array<{
    address: string;
    lat?: number;
    lng?: number;
  }>;
  preferredType?: 'VILLA' | 'APARTMENT' | 'CONDO' | 'STUDIO' | 'HOUSE' | 'SHARED_ROOM' | 'SERVICED_APARTMENT' | 'PENTHOUSE';
  amenities?: string[];
  furnishStatus?: 'furnished' | 'semi-furnished' | 'unfurnished';
};

function buildPreferenceResponse(pref: any) {
  if (!pref) return null;

  return {
    budget: {
      min: pref.preferredPriceMin,
      max: pref.preferredPriceMax,
      currency: pref.preferredCurrency || 'ETB',
    },
    bedrooms: pref.preferredBedrooms,
    preferredLocations: pref.preferredLocations || [],
    preferredType: pref.preferredType ?? null,
    amenities: pref.preferredAmenities || [],
    furnishStatus: pref.furnishStatus ?? null,
    updatedAt: pref.updatedAt,
  };
}

class RecommendationService {
  // ========================
  // USER PREFERENCES
  // ========================
  async savePreferences(userId: string, data: PreferencePayload) {
    const dbData: any = {};

    if (data.budget) {
      if (data.budget.min !== undefined) dbData.preferredPriceMin = data.budget.min;
      if (data.budget.max !== undefined) dbData.preferredPriceMax = data.budget.max;
      if (data.budget.currency !== undefined) dbData.preferredCurrency = data.budget.currency;
    }

    if (data.bedrooms !== undefined) {
      if (typeof data.bedrooms === 'number') {
        dbData.preferredBedrooms = data.bedrooms;
      } else {
        dbData.preferredBedrooms = data.bedrooms.min ?? data.bedrooms.max;
      }
    }

    if (data.preferredLocations !== undefined) {
      dbData.preferredLocations = data.preferredLocations.map((location) => ({
        address: location.address,
        lat: location.lat ?? null,
        lng: location.lng ?? null,
      }));
    }

    if (data.preferredType !== undefined) {
      dbData.preferredType = data.preferredType;
    }

    if (data.amenities !== undefined) {
      dbData.preferredAmenities = data.amenities;
    }

    if (data.furnishStatus !== undefined) {
      dbData.furnishStatus = data.furnishStatus;
    }

    const pref = await prisma.userPreference.upsert({
      where: { userId },
      update: dbData,
      create: { userId, ...dbData },
    });

    return buildPreferenceResponse(pref);
  }

  async updatePreferences(userId: string, data: PreferencePayload) {
    return this.savePreferences(userId, data);
  }

  async getPreferences(userId: string) {
    const pref = await prisma.userPreference.findUnique({ where: { userId } });
    return buildPreferenceResponse(pref);
  }

  // ========================
  // SEARCH HISTORY
  // ========================
  async saveSearch(userId: string, query: string, filters: any) {
    return prisma.searchHistory.create({
      data: { userId, query, filters },
    });
  }

  async getSearchHistory(userId: string) {
    return prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  }

  // ========================
  // INTERACTIONS
  // ========================
  async trackInteraction(
    userId: string,
    propertyId: string,
    type: 'VIEW' | 'LIKE' | 'SAVE'
  ) {
    const idempotencyKey = `legacy-track-${type}-${userId}-${propertyId}`;

    if (type === 'VIEW') {
      const dayKey = new Date().toISOString().slice(0, 10);
      return interactionService.recordView(userId, {
        propertyId,
        idempotencyKey: `legacy-view-${userId}-${propertyId}-${dayKey}`,
      });
    }

    if (type === 'LIKE') {
      return interactionService.likeProperty(userId, {
        propertyId,
        idempotencyKey,
        source: 'PROPERTY_DETAIL_PAGE',
      });
    }

    return interactionService.saveProperty(userId, {
      propertyId,
      idempotencyKey,
      source: 'PROPERTY_DETAIL_PAGE',
    });
  }

  // ========================
  // USER EMBEDDING (NEW)
  // ========================
  async getUserEmbedding(userId: string) {
    const likedAndSaved = await prisma.userPropertyState.findMany({
      where: {
        userId,
        OR: [{ isLiked: true }, { isSaved: true }],
      },
      select: { propertyId: true },
    });

    const propertyIds = likedAndSaved.map((s) => s.propertyId);

    const properties = await prisma.property.findMany({
      where: { id: { in: propertyIds } },
      include: { embedding: true },
    });

    const vectors: number[][] = properties
      .map((p) => p.embedding?.embedding)
      .filter((e): e is number[] => Array.isArray(e));

    if (vectors.length === 0) return null;

    const length = vectors[0].length;
    const avg = new Array<number>(length).fill(0);

    for (const vec of vectors) {
      for (let i = 0; i < length; i++) {
        avg[i] += vec[i];
      }
    }

    return avg.map((v) => v / vectors.length);
  }
  // ========================
  // COLLABORATIVE FILTERING (NEW)
  // ========================
  async getCollaborativeRecommendations(userId: string) {
    const myStates = await prisma.userPropertyState.findMany({
      where: {
        userId,
        OR: [{ isLiked: true }, { isSaved: true }],
      },
      select: { propertyId: true },
    });

    const propertyIds = myStates.map((s) => s.propertyId);
    if (propertyIds.length === 0) return [];

    const similarUsers = await prisma.userPropertyState.findMany({
      where: {
        propertyId: { in: propertyIds },
        userId: { not: userId },
        OR: [{ isLiked: true }, { isSaved: true }],
      },
      select: { userId: true },
    });

    const userIds = [...new Set(similarUsers.map((u) => u.userId))];

    const recommendations = await prisma.userPropertyState.findMany({
      where: {
        userId: { in: userIds },
        propertyId: { notIn: propertyIds },
        OR: [{ isLiked: true }, { isSaved: true }],
      },
      select: { propertyId: true },
    });

    const recommendedIds = [...new Set(recommendations.map((r) => r.propertyId))];

    return prisma.property.findMany({
      where: {
        id: { in: recommendedIds },
        isDeleted: false,
        status: 'AVAILABLE',
      },
      take: 10,
    });
  }

  // ========================
  // MAIN RECOMMENDATION ENGINE
  // ========================
  async getRecommendations(userId: string) {
    // FAST PATH: Check the Python Recommendation Microservice (Redis/DB Precomputed)
    try {
      const recommendationUrl = process.env.RECOMMENDATION_URL || 'http://recommendation-service:8001';
      const response = await fetch(`${recommendationUrl}/api/v1/recommendations/${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.recommendations && data.recommendations.length > 0) {
          // Fetch property objects for the returned IDs
          const properties = await prisma.property.findMany({
            where: {
              id: { in: data.recommendations },
              isDeleted: false,
              status: 'AVAILABLE'
            },
            include: {
              reviews: true,
            }
          });

          // Maintain AI ranking order
          const propMap = new Map(properties.map(p => [p.id, p]));
          const sortedProps = data.recommendations.map((id: string) => propMap.get(id)).filter(Boolean);

          if (sortedProps.length > 0) {
            return sortedProps;
          }
        }
      }
    } catch (e) {
      console.error('Microservice unavailable or empty:', e);
    }

    const collaborative = await this.getCollaborativeRecommendations(userId);
    if (collaborative.length > 0) {
      return collaborative;
    }

    return [];
  }

  // ========================
  // SIMILAR PROPERTIES
  // ========================
  async getSimilarProperties(propertyId: string) {
    const base = await prisma.propertyEmbedding.findUnique({
      where: { propertyId },
    });

    if (!base) return [];

    const all = await prisma.propertyEmbedding.findMany();

    return all
      .filter((p) => p.propertyId !== propertyId)
      .map((p) => ({
        propertyId: p.propertyId,
        similarity: cosineSimilarity(base.embedding, p.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);
  }
}

export default new RecommendationService();
