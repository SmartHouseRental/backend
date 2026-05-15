import { z } from 'zod';

// ===========================
// Profile Schemas
// ===========================

export const updatePersonalInfoSchema = z.object({
  body: z.object({
    fullName: z.string().min(2).max(100).optional(),
    phone: z
      .string()
      .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone format')
      .optional(),
    location: z.string().max(200).optional(),
    bio: z.string().max(500).optional(),
  }),
});

export type UpdatePersonalInfoInput = z.infer<typeof updatePersonalInfoSchema>;

// ===========================
// Avatar Upload Schema
// ===========================

export const uploadAvatarSchema = z.object({
  file: z.object({
    size: z.number().max(5 * 1024 * 1024, 'File size must not exceed 5MB'),
    mimetype: z.enum(['image/jpeg', 'image/png', 'image/jpg'], {
      message: 'Only JPEG, PNG formats are allowed',
    }),
  }),
});

export type UploadAvatarInput = z.infer<typeof uploadAvatarSchema>;

// ===========================
// Verification Document Schema
// ===========================

export const uploadDocumentSchema = z.object({
  body: z.object({
    documentType: z.enum(['NATIONAL_ID_FRONT', 'NATIONAL_ID_BACK', 'OWNER_PHOTO'], {
      message: 'Invalid document type',
    }),
  }),
  file: z.object({
    size: z.number().max(5 * 1024 * 1024, 'File size must not exceed 5MB'),
    mimetype: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'], {
      message: 'Only PDF, JPEG, PNG formats are allowed',
    }),
  }),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

// ===========================
// Bank Details Schema
// ===========================

export const updateBankDetailsSchema = z.object({
  body: z.object({
    bankName: z.string().min(2).max(100),
    accountNumber: z.string().min(8).max(50),
    holderName: z.string().min(2).max(100),
    branch: z.string().max(100).optional(),
  }),
});

export type UpdateBankDetailsInput = z.infer<typeof updateBankDetailsSchema>;

// ===========================
// Notification Preferences Schema
// ===========================

export const updateNotificationPreferencesSchema = z.object({
  body: z.object({
    appointments: z.boolean().optional(),
    agreements: z.boolean().optional(),
    payments: z.boolean().optional(),
    reviews: z.boolean().optional(),
    reports: z.boolean().optional(),
    system: z.boolean().optional(),
  }),
});

export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;

// ===========================
// Language Preference Schema
// ===========================

export const updateLanguagePreferenceSchema = z.object({
  body: z.object({
    language: z.enum(['en', 'am', 'or', 'ti']),
  }),
});

export type UpdateLanguagePreferenceInput = z.infer<typeof updateLanguagePreferenceSchema>;

// ===========================
// Change Password Schema
// ===========================

export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(8, 'Current password is required'),
      newPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must be at most 128 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(
          /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
          'Password must contain at least one special character'
        ),
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
      message: 'New password must be different from current password',
      path: ['newPassword'],
    }),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
