import { Request, Response } from 'express';
import { updateProfileSchema, updateUserRoleSchema, updateUserStatusSchema } from './schema';
import * as userService from './service';
import { changePasswordSchema } from './schema';

export async function getProfile(req: Request, res: Response) {
  const userId = (req as { userId?: string }).userId;
  if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  const user = await userService.getProfile(userId);
  return res.status(200).json({ status: 'success', data: { user } });
}

export async function updateProfile(req: Request, res: Response) {
  const userId = (req as { userId?: string }).userId;
  if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  const parsed = updateProfileSchema.safeParse({ body: req.body });
  if (!parsed.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }
  const user = await userService.updateProfile(userId, parsed.data.body);
  return res.status(200).json({ status: 'success', data: { user } });
}


export async function changePassword(req: Request, res: Response) {
  const userId = (req as any).userId;

  if (!userId) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized',
    });
  }

  const parsed = changePasswordSchema.safeParse({ body: req.body });

  if (!parsed.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const result = await userService.changePassword(
      userId,
      parsed.data.body
    );

    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error: any) {
    return res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
}
export async function getAllUsers(req: Request, res: Response) {
  try {
    const users = await userService.getAllUsers();

    return res.status(200).json({
      status: 'success',
      results: users.length,
      data: users,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
}
export async function updateUserRole(req: Request, res: Response) {
  const parsed = updateUserRoleSchema.safeParse({
    params: req.params,
    body: req.body,
  });

  if (!parsed.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const { id } = parsed.data.params;
    const { role } = parsed.data.body;

    const user = await userService.updateUserRole(id, role);

    return res.status(200).json({
      status: 'success',
      data: user,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
}
export async function updateUserStatus(req: Request, res: Response) {
  const parsed = updateUserStatusSchema.safeParse({
    params: req.params,
    body: req.body,
  });

  if (!parsed.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const { id } = parsed.data.params;
    const { isActive } = parsed.data.body;

    const user = await userService.updateUserStatus(id, isActive);

    return res.status(200).json({
      status: 'success',
      data: user,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
}
export async function updateSettings(req: Request, res: Response) {
  const userId = (req as any).userId;

  const user = await userService.updateProfile(userId, req.body);

  return res.status(200).json({
    status: 'success',
    data: user,
  });
}

