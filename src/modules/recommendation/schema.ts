import { z } from 'zod';

const localizedTextSchema = z.object({
  en: z.string().min(1),
  am: z.string().min(1).optional(),
});

const localizedValueSchema = z.union([localizedTextSchema, z.string().min(1)]);

const locationSchema = z.object({
  city: localizedValueSchema,
  region: localizedValueSchema.optional(),
  state: localizedValueSchema.optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

const propertyTypeSchema = z.union([localizedTextSchema, z.string().min(1)]);
const furnishStatusSchema = z.enum(['furnished', 'semiFurnished', 'unfunished']);

export const preferenceSchema = z.object({
  budget: z
    .object({
      min: z.number().nonnegative().optional(),
      max: z.number().nonnegative().optional(),
      currency: z.string().default('ETB'),
    })
    .optional(),
  bedrooms: z.union([z.number().int().nonnegative(), z.object({
    min: z.number().int().nonnegative().optional(),
    max: z.number().int().nonnegative().optional(),
  })]).optional(),
  preferredLocations: z.array(
    z.object({
      address: z.string().min(1),
      lat: z.number().optional(),
      lng: z.number().optional(),
    })
  ).optional(),
  preferredType: z.enum(['VILLA', 'APARTMENT', 'CONDO', 'STUDIO', 'HOUSE', 'PENTHOUSE']).optional(),
  amenities: z.array(z.string()).optional(),
  furnishStatus: z.enum(['furnished', 'semi-furnished', 'unfurnished']).optional(),
});

export const searchSchema = z.object({
  query: z.string().min(1),
  filters: z.any().optional(),
});

export const interactionSchema = z.object({
  propertyId: z.string().min(1),
  type: z.enum(['VIEW', 'LIKE', 'SAVE']),
});
