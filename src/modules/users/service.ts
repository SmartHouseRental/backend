import prisma from '../../config/database';
import { AppError } from '../../core/AppError';
import type { UpdateProfileInput } from './schema';
import bcrypt from 'bcryptjs';

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      phone: true,
      image: true,
      preferredLanguage: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) throw new AppError('User not found', 404);

  return user;
}

export async function updateProfile(userId: string, input: any) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      first_name: input.first_name,
      last_name: input.last_name,
      phone: input.phone,
      image: input.image,
      preferredLanguage: input.preferredLanguage,
    },
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      phone: true,
      image: true,
      preferredLanguage: true,
      role: true,
    },
  });
}

export async function changePassword(
  userId: string,
  data: { currentPassword: string; newPassword: string }
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (!user.password) {
    throw new Error('Password is not set for this account');
  }

  const isMatch = await bcrypt.compare(data.currentPassword, user.password);

  if (!isMatch) {
    throw new Error('Current password is incorrect');
  }

  const hashedPassword = await bcrypt.hash(data.newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return { message: 'Password updated successfully' };
}

export async function getAllUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      role: true,
      isVerified: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return users;
}
export async function updateUserRole(userId: string, role: 'renter' | 'owner' | 'admin') {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      role: true,
      isVerified: true,
    },
  });

  return user;
}
export async function updateUserStatus(userId: string, isActive: boolean) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { isVerified: isActive },
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      role: true,
      isVerified: true,
    },
  });

  return user;
}
