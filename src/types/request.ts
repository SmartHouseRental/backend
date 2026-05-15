import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  userId: string;
  userRole: string;
}

export type UploadedFile = Express.Multer.File;
