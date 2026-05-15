import type { Request, Response } from 'express';
import type { AuthenticatedRequest, UploadedFile } from '../../types/request';
import * as profileService from './service';
import {
  updatePersonalInfoSchema,
  uploadAvatarSchema,
  updateBankDetailsSchema,
  updateNotificationPreferencesSchema,
  updateLanguagePreferenceSchema,
  changePasswordSchema,
} from './schema';

/**
 * Helper to handle errors in a consistent senior-level way
 */
const handleError = (res: Response, error: any) => {
  console.error('[ProfileController Error]:', error);
  
  if (error.message === 'User not found') {
    return res.status(404).json({ status: 'error', message: error.message });
  }
  
  if (error.message === 'Current password is incorrect') {
    return res.status(400).json({ status: 'error', message: error.message });
  }

  return res.status(500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
  });
};

/**
 * GET /api/v1/owners/profile
 */
export async function getProfile(req: Request, res: Response) {
  try {
    const auth = req as AuthenticatedRequest;
    const userId = auth.userId;

    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const data = await profileService.getProfile(userId);

    return res.status(200).json({
      status: 'success',
      message: 'Profile loaded',
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

/**
 * PATCH /api/v1/owners/profile
 */
export async function updatePersonalInfo(req: Request, res: Response) {
  try {
    const auth = req as AuthenticatedRequest;
    const userId = auth.userId;

    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const file = req.file as UploadedFile | undefined;

    // Validate body
    const bodyParsed = updatePersonalInfoSchema.safeParse({ body: req.body });
    if (!bodyParsed.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: bodyParsed.error.flatten().fieldErrors,
      });
    }

    // Validate file if provided
    if (file) {
      const fileParsed = uploadAvatarSchema.safeParse({
        file: { size: file.size, mimetype: file.mimetype },
      });
      if (!fileParsed.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Avatar validation failed',
          errors: fileParsed.error.flatten().fieldErrors,
        });
      }
    }

    const data = await profileService.updatePersonalInfo(userId, bodyParsed.data.body, file);

    return res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}


/**
 * POST /api/v1/owners/profile/documents
 * Accepts up to three files: nationalIdFront, nationalIdBack, ownerPhoto
 */
export async function uploadDocument(req: Request, res: Response) {
  try {
    const auth = req as AuthenticatedRequest;
    const userId = auth.userId;

    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const files = req.files as Record<string, UploadedFile[]> | undefined;

    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({ status: 'error', message: 'No files provided' });
    }

    const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    const MAX_SIZE = 5 * 1024 * 1024;

    const fieldToDocType: Record<string, string> = {
      nationalIdFront: 'NATIONAL_ID_FRONT',
      nationalIdBack:  'NATIONAL_ID_BACK',
      ownerPhoto:      'OWNER_PHOTO',
    };

    // Validate all provided files before saving any
    for (const [fieldName, fileArr] of Object.entries(files)) {
      const file = fileArr[0];
      if (!fieldToDocType[fieldName]) {
        return res.status(400).json({
          status: 'error',
          message: `Unknown field: ${fieldName}. Allowed: nationalIdFront, nationalIdBack, ownerPhoto`,
        });
      }
      if (file.size > MAX_SIZE) {
        return res.status(413).json({
          status: 'error',
          message: `File "${fieldName}" exceeds the 5 MB limit`,
        });
      }
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return res.status(400).json({
          status: 'error',
          message: `File "${fieldName}" has an unsupported format. Allowed: pdf, jpg, jpeg, png`,
        });
      }
    }

    // Upload sequentially to avoid race conditions on the single-record upsert
    for (const [fieldName, fileArr] of Object.entries(files)) {
      await profileService.uploadDocument(userId, fieldToDocType[fieldName], fileArr[0]);
    }

    // After all uploads, fetch the single record to build one consolidated response
    const doc = await profileService.getVerificationDoc(userId);

    const uploadedFiles: { documentType: string; label: string; file: string }[] = [];
    if (doc?.frontUrl) {
      uploadedFiles.push({ documentType: 'NATIONAL_ID_FRONT', label: 'National ID - Front', file: doc.frontUrl.split('/').pop()! });
    }
    if (doc?.backUrl) {
      uploadedFiles.push({ documentType: 'NATIONAL_ID_BACK',  label: 'National ID - Back',  file: doc.backUrl.split('/').pop()!  });
    }
    if (doc?.livePhotoUrl) {
      uploadedFiles.push({ documentType: 'OWNER_PHOTO',       label: 'Your Photo',           file: doc.livePhotoUrl.split('/').pop()! });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Documents uploaded successfully',
      data: {
        id:           doc!.id,
        overallStatus: doc!.status,   // single status — admin reviews once
        submittedAt:  doc!.submittedAt,
        uploadedFiles,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
}

/**
 * GET /api/v1/owners/profile/documents
 */
export async function getDocuments(req: Request, res: Response) {
  try {
    const auth = req as AuthenticatedRequest;
    const userId = auth.userId;

    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const doc = await profileService.getVerificationDoc(userId);

    if (!doc) {
      return res.status(200).json({
        status: 'success',
        message: 'No documents found',
        data: null,
      });
    }

    const uploadedFiles: { documentType: string; label: string; file: string; url: string }[] = [];
    if (doc.frontUrl) {
      uploadedFiles.push({
        documentType: 'NATIONAL_ID_FRONT',
        label: 'National ID - Front',
        file: doc.frontUrl.split('/').pop()!,
        url: doc.frontUrl,
      });
    }
    if (doc.backUrl) {
      uploadedFiles.push({
        documentType: 'NATIONAL_ID_BACK',
        label: 'National ID - Back',
        file: doc.backUrl.split('/').pop()!,
        url: doc.backUrl,
      });
    }
    if (doc.livePhotoUrl) {
      uploadedFiles.push({
        documentType: 'OWNER_PHOTO',
        label: 'Your Photo',
        file: doc.livePhotoUrl.split('/').pop()!,
        url: doc.livePhotoUrl,
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        id: doc.id,
        overallStatus: doc.status,
        submittedAt: doc.submittedAt,
        uploadedFiles,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
}

/**
 * PATCH /api/v1/owners/profile/bank
 */
export async function updateBankDetails(req: Request, res: Response) {
  try {
    const auth = req as AuthenticatedRequest;
    const userId = auth.userId;

    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const parsed = updateBankDetailsSchema.safeParse({ body: req.body });
    if (!parsed.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const data = await profileService.updateBankDetails(userId, parsed.data.body);

    return res.status(200).json({
      status: 'success',
      message: 'Bank details updated successfully',
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

/**
 * PATCH /api/v1/owners/profile/notifications
 */
export async function updateNotificationPreferences(req: Request, res: Response) {
  try {
    const auth = req as AuthenticatedRequest;
    const userId = auth.userId;

    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const parsed = updateNotificationPreferencesSchema.safeParse({ body: req.body });
    if (!parsed.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const data = await profileService.updateNotificationPreferences(userId, parsed.data.body);

    return res.status(200).json({
      status: 'success',
      message: 'Notification preferences updated successfully',
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

/**
 * PATCH /api/v1/owners/profile/language
 */
export async function updateLanguagePreference(req: Request, res: Response) {
  try {
    const auth = req as AuthenticatedRequest;
    const userId = auth.userId;

    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const parsed = updateLanguagePreferenceSchema.safeParse({ body: req.body });
    if (!parsed.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const data = await profileService.updateLanguagePreference(userId, parsed.data.body);

    return res.status(200).json({
      status: 'success',
      message: 'Language preference updated successfully',
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

/**
 * POST /api/v1/owners/profile/change-password
 */
export async function changePassword(req: Request, res: Response) {
  try {
    const auth = req as AuthenticatedRequest;
    const userId = auth.userId;

    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const parsed = changePasswordSchema.safeParse({ body: req.body });
    if (!parsed.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    await profileService.changePassword(userId, parsed.data.body);

    return res.status(200).json({
      status: 'success',
      message: 'Password changed successfully',
    });
  } catch (error) {
    return handleError(res, error);
  }
}
