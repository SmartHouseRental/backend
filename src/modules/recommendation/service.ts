import prisma from '../../config/database';
import { cosineSimilarity } from '../../utils/similarity.utils';
import { InteractionType } from '@prisma/client';

type LocalizedText = {
  en: string | null;
  am: string | null;
};

type PreferenceLocation = {
  city: LocalizedText;
  region: LocalizedText;
  lat: number | null;
  lng: number | null;
};

type PreferencePayload = {
  budget?: { min?: number; max?: number; currency?: string };
  bedrooms?: number | { min?: number; max?: number };
  preferredLocations?: Array<{
    address: string;
    lat?: number;
    lng?: number;
  }>;
  preferredType?: 'VILLA' | 'APARTMENT' | 'CONDO' | 'STUDIO' | 'HOUSE' | 'PENTHOUSE';
  amenities?: string[];
  furnishStatus?: 'furnished' | 'semi-furnished' | 'unfurnished';
};

function buildPreferenceResponse(pref: any) {
  if (!pref) return null;

  // Multilingual mapping for Property Type
  const propertyTypeMap: Record<string, { en: string; am: string }> = {
    VILLA: { en: 'VILLA', am: 'ቪላ' },
    APARTMENT: { en: 'APARTMENT', am: 'አፓርትመንት' },
    CONDO: { en: 'CONDO', am: 'ኮንዶ' },
    STUDIO: { en: 'STUDIO', am: 'ስቱዲዮ' },
    HOUSE: { en: 'HOUSE', am: 'ቤት' },
    PENTHOUSE: { en: 'PENTHOUSE', am: 'ፔንትሃውስ' },
  };

  // Multilingual mapping for Furnish Status
  const furnishStatusMap: Record<string, { en: string; am: string }> = {
    furnished: { en: 'furnished', am: 'የታጠቀ' },
    'semi-furnished': { en: 'semi-furnished', am: 'በከፊል የታጠቀ' },
    unfurnished: { en: 'unfurnished', am: 'ያልታጠቀ' },
  };

  return {
    budget: {
      min: pref.preferredPriceMin,
      max: pref.preferredPriceMax,
      currency: pref.preferredCurrency || 'ETB',
    },
    bedrooms: pref.preferredBedrooms,
    preferredLocations: pref.preferredLocations || [],
    preferredType: pref.preferredType ? (propertyTypeMap[pref.preferredType] || { en: pref.preferredType, am: pref.preferredType }) : null,
    amenities: pref.preferredAmenities || [],
    furnishStatus: pref.furnishStatus ? (furnishStatusMap[pref.furnishStatus] || { en: pref.furnishStatus, am: pref.furnishStatus }) : null,
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
      dbData.preferredPriceMin = data.budget.min;
      dbData.preferredPriceMax = data.budget.max;
      dbData.preferredCurrency = data.budget.currency;
    }

    if (data.bedrooms !== undefined) {
      if (typeof data.bedrooms === 'number') {
        dbData.preferredBedrooms = data.bedrooms;
      } else {
        dbData.preferredBedrooms = data.bedrooms.min || data.bedrooms.max;
      }
    }

    if (data.preferredLocations) {
      dbData.preferredLocations = data.preferredLocations;
    }

    if (data.preferredType) {
      dbData.preferredType = data.preferredType;
    }

    if (data.amenities) {
      dbData.preferredAmenities = data.amenities;
    }

    if (data.furnishStatus) {
      dbData.furnishStatus = data.furnishStatus;
    }

    const pref = await prisma.userPreference.upsert({
      where: { userId },
      update: dbData,
      create: { userId, ...dbData },
    });

    return buildPreferenceResponse(pref);
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
  async trackInteraction(userId: string, propertyId: string, type: InteractionType) {
    // Ensure the property exists to avoid foreign key violation
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) {
      // Use AppError for consistent error handling
      const { AppError } = await import('../../core/AppError');
      throw new AppError('Property not found', 404);
    }

    return prisma.userInteraction.create({
      data: { userId, propertyId, type },
    });
  }

  // ========================
  // USER EMBEDDING (NEW)
  // ========================
  async getUserEmbedding(userId: string) {
    const interactions = await prisma.userInteraction.findMany({
      where: {
        userId,
        type: { in: ['LIKE', 'SAVE'] },
      },
      include: {
        property: {
          include: { embedding: true },
        },
      },
    });

    // ✅ properly typed filtering
    const vectors: number[][] = interactions
      .map((i) => i.property.embedding?.embedding)
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
    const myInteractions = await prisma.userInteraction.findMany({
      where: { userId },
      select: { propertyId: true },
    });

    const propertyIds = myInteractions.map((i) => i.propertyId);
    if (propertyIds.length === 0) return [];

    const similarUsers = await prisma.userInteraction.findMany({
      where: {
        propertyId: { in: propertyIds },
        userId: { not: userId },
      },
      select: { userId: true },
    });

    const userIds = [...new Set(similarUsers.map((u) => u.userId))];

    const recommendations = await prisma.userInteraction.findMany({
      where: {
        userId: { in: userIds },
        propertyId: { notIn: propertyIds },
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
    const preferences = await prisma.userPreference.findUnique({ where: { userId } });
    const searches = await this.getSearchHistory(userId);

    const interactions = await prisma.userInteraction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const userEmbedding = await this.getUserEmbedding(userId);

    const viewedEmbeddings = await prisma.propertyEmbedding.findMany({
      where: {
        propertyId: { in: interactions.map((i) => i.propertyId) },
      },
    });

    const properties = await prisma.property.findMany({
      where: { isDeleted: false, status: 'AVAILABLE' },
      include: {
        reviews: true,
        embedding: true,
      },
    });

    const scored = properties.map((property) => {
      let score = 0;
      const reasons: string[] = [];

      // ========================
      // PREFERENCES
      // ========================
      if (preferences) {
        if (
          preferences.preferredPriceMin !== null &&
          preferences.preferredPriceMax !== null &&
          property.price >= preferences.preferredPriceMin &&
          property.price <= preferences.preferredPriceMax
        ) {
          score += 30;
          reasons.push('matches your budget');
        }

        const preferredLocations = preferences.preferredLocations as any[];
        if (
          Array.isArray(preferredLocations) &&
          preferredLocations.some((loc: any) => loc.address === property.location)
        ) {
          score += 25;
          reasons.push('preferred location');
        }
      }

      // ========================
      // SEARCH MATCHING
      // ========================
      searches.forEach((s) => {
        if (property.title?.toString().toLowerCase().includes(s.query.toLowerCase())) {
          score += 20;
          reasons.push('matches your search');
        }
      });

      // ========================
      // PROPERTY SIMILARITY (EXISTING)
      // ========================
      if (property.embedding && viewedEmbeddings.length > 0) {
        let maxSim = 0;

        for (const viewed of viewedEmbeddings) {
          const sim = cosineSimilarity(property.embedding.embedding, viewed.embedding);
          if (sim > maxSim) maxSim = sim;
        }

        if (maxSim > 0.5) {
          score += maxSim * 50;
          reasons.push('similar to viewed properties');
        }
      }

      // ========================
      // USER EMBEDDING (NEW AI)
      // ========================
      if (userEmbedding && property.embedding) {
        const sim = cosineSimilarity(userEmbedding, property.embedding.embedding);

        if (sim > 0.5) {
          score += sim * 60;
          reasons.push('matches your taste');
        }
      }

      // ========================
      // RATING BOOST
      // ========================
      if (property.reviews.length > 0) {
        const avg = property.reviews.reduce((a, r) => a + r.rating, 0) / property.reviews.length;
        score += avg * 5;
      }

      return { property, score, reasons };
    });

    // ========================
    // COLLABORATIVE RESULTS
    // ========================
    const collaborative = await this.getCollaborativeRecommendations(userId);

    const topScored = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 7)
      .map((s) => s.property);

    const collabTop = collaborative.slice(0, 3);

    return [...topScored, ...collabTop];
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
