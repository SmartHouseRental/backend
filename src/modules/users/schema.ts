import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z.object({
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
    phone: z.string().optional(),
    image: z.string().optional(),
    preferredLanguage: z.string().optional(),
  }),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(6),
  }),
});

export const updateSettingsSchema = z.object({
  body: z.object({
    preferredLanguage: z.string().optional(),
  }),
});

export const updateUserRoleSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
  body: z.object({
    role: z.enum(['renter', 'owner', 'admin']),
  }),
});

export const updateUserStatusSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
  body: z.object({
    isActive: z.boolean(),
  }),
});