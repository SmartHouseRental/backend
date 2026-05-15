import prisma from '../../config/database';
import { hash, compare } from 'bcryptjs';
import type {
  UpdatePersonalInfoInput,
  UpdateBankDetailsInput,
  UpdateNotificationPreferencesInput,
  UpdateLanguagePreferenceInput,
  ChangePasswordInput,
} from './schema';
import type { UploadedFile } from '../../types/request';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Senior Developer Note: Standardizing status and metadata mapping
 * to ensure frontend consistency and loose coupling with DB enums.
 */

const DOCUMENT_METADATA: Record<string, { label: string; description: string }> = {
  NATIONAL_ID_FRONT: {
    label: 'National ID - Front',
    description: 'Government-issued photo ID',
  },
  NATIONAL_ID_BACK: {
    label: 'National ID - Back',
    description: 'Back of government-issued ID',
  },
  OWNER_PHOTO: {
    label: 'Your Photo',
    description: 'Proof of you own the ID',
  },
};

/**
 * Format verification document status
 */
function mapDocumentStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: 'pending',
    approved: 'verified',
    rejected: 'rejected',
    resubmit: 'resubmit',
  };
  return statusMap[status] || status;
}

/**
 * Get owner's full profile
 */
export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      verificationDocs: true,
      bankDetail: true,
      notificationPreference: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // One verification record per user — map three URL slots to document items for the frontend
  const doc = user.verificationDocs[0] ?? null;
  const documents = [];

  if (doc) {
    if (doc.frontUrl) {
      documents.push({
        id: `${doc.id}-front`,
        documentType: 'NATIONAL_ID_FRONT',
        label: DOCUMENT_METADATA.NATIONAL_ID_FRONT.label,
        description: DOCUMENT_METADATA.NATIONAL_ID_FRONT.description,
        file: path.basename(doc.frontUrl),
      });
    }
    if (doc.backUrl) {
      documents.push({
        id: `${doc.id}-back`,
        documentType: 'NATIONAL_ID_BACK',
        label: DOCUMENT_METADATA.NATIONAL_ID_BACK.label,
        description: DOCUMENT_METADATA.NATIONAL_ID_BACK.description,
        file: path.basename(doc.backUrl),
      });
    }
    if (doc.livePhotoUrl) {
      documents.push({
        id: `${doc.id}-photo`,
        documentType: 'OWNER_PHOTO',
        label: DOCUMENT_METADATA.OWNER_PHOTO.label,
        description: DOCUMENT_METADATA.OWNER_PHOTO.description,
        file: path.basename(doc.livePhotoUrl),
      });
    }
  }

  const verification = doc
    ? {
        status: mapDocumentStatus(doc.status),
        submittedAt: doc.submittedAt.toISOString(),
        documents,
      }
    : null;

  // Mask account number (show only last 4 digits) for security
  const maskAccountNumber = (num: string | null) => {
    if (!num) return null;
    return num.replace(/.(?=.{4})/g, '*');
  };

  return {
    id: user.id,
    fullName: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || 'Unknown',
    email: user.email,
    phone: user.phone,
    location: (user as any).location || '',
    bio: (user as any).bio || '',
    image: user.image,
    verificationState: user.verificationState,
    isVerified: user.isVerified,
    emailVerified: user.emailVerified,
    verification,
    bankDetails: (user as any).bankDetail
      ? {
          id: (user as any).bankDetail.id,
          bankName: (user as any).bankDetail.bankName,
          accountNumber: maskAccountNumber((user as any).bankDetail.accountNumber),
          holderName: (user as any).bankDetail.holderName,
          branch: (user as any).bankDetail.branch,
        }
      : null,
    notificationPreferences: (user as any).notificationPreference || {
      appointments: true,
      agreements: true,
      payments: true,
      reviews: false,
      reports: true,
      system: false,
    },
    language: user.preferredLanguage || 'en',
    preferedlanguage: user.preferredLanguage || 'en',
    status: user.status,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * Update personal information
 */
export async function updatePersonalInfo(
  userId: string,
  data: UpdatePersonalInfoInput['body'],
  file?: UploadedFile
) {
  const fullName = data.fullName || '';
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || null;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

  let imageUrl: string | undefined;
  if (file) {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `avatar-${userId}-${timestamp}${ext}`;
    const filepath = path.join(process.cwd(), 'uploads/avatars', filename);

    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, file.buffer);
    imageUrl = `/uploads/avatars/${filename}`;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      first_name: firstName,
      last_name: lastName,
      phone: data.phone,
      location: data.location,
      bio: data.bio,
      ...(imageUrl && { image: imageUrl }),
    },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      phone: true,
      location: true,
      bio: true,
      image: true,
    },
  });

  return {
    id: user.id,
    fullName: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
    email: user.email,
    phone: user.phone,
    location: user.location,
    bio: user.bio,
    image: user.image,
  };
}

/**
 * Upload profile avatar
 */

/**
 * Upload verification document
 * All files go into a single record per user — admin reviews the whole submission at once.
 * Returns the full updated record (not per-file) so the caller can build one overall response.
 */
export async function uploadDocument(userId: string, documentType: string, file: UploadedFile) {
  const timestamp = Date.now();
  const ext = path.extname(file.originalname);
  const filename = `doc-${userId}-${documentType.toLowerCase()}-${timestamp}${ext}`;
  const filepath = path.join(process.cwd(), 'uploads/documents', filename);

  await fs.mkdir(path.dirname(filepath), { recursive: true });
  await fs.writeFile(filepath, file.buffer);

  const fileUrl = `/uploads/documents/${filename}`;

  // Map documentType → URL field on the single record
  const urlField: Record<string, string> = {
    NATIONAL_ID_FRONT: 'frontUrl',
    NATIONAL_ID_BACK:  'backUrl',
    OWNER_PHOTO:       'livePhotoUrl',
  };

  const field = urlField[documentType];
  if (!field) throw new Error(`Invalid documentType: ${documentType}`);

  // Upsert one record per user — only update the relevant URL field,
  // reset overall status to pending so admin re-reviews
  return prisma.verificationDocument.upsert({
    where:  { userId },
    create: { userId, [field]: fileUrl, status: 'pending', submittedAt: new Date() },
    update: { [field]: fileUrl, status: 'pending', submittedAt: new Date() },
  });
}

/**
 * Fetch the single verification document record for a user
 */
export async function getVerificationDoc(userId: string) {
  return prisma.verificationDocument.findUnique({ where: { userId } });
}

/**
 * Update bank details
 */
export async function updateBankDetails(userId: string, data: UpdateBankDetailsInput['body']) {
  const bankDetail = await prisma.bankDetail.upsert({
    where: { userId },
    create: {
      userId,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      holderName: data.holderName,
      branch: data.branch || null,
    },
    update: {
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      holderName: data.holderName,
      branch: data.branch || null,
    },
  });

  return {
    id: bankDetail.id,
    bankName: bankDetail.bankName,
    accountNumber: bankDetail.accountNumber.replace(/.(?=.{4})/g, '*'),
    holderName: bankDetail.holderName,
    branch: bankDetail.branch,
  };
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  userId: string,
  data: UpdateNotificationPreferencesInput['body']
) {
  const preferences = await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  return {
    appointments: preferences.appointments,
    agreements: preferences.agreements,
    payments: preferences.payments,
    reviews: preferences.reviews,
    reports: preferences.reports,
    system: preferences.system,
  };
}

/**
 * Update language preference
 */
export async function updateLanguagePreference(
  userId: string,
  data: UpdateLanguagePreferenceInput['body']
) {
  await prisma.user.update({
    where: { id: userId },
    data: { preferredLanguage: data.language },
  });

  return { language: data.language };
}

/**
 * Change user password
 */
export async function changePassword(userId: string, data: ChangePasswordInput['body']) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });

  if (!user || !user.password) {
    throw new Error('User not found or password not set');
  }

  const isPasswordValid = await compare(data.currentPassword, user.password);
  if (!isPasswordValid) {
    throw new Error('Current password is incorrect');
  }

  const hashedPassword = await hash(data.newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });
}
