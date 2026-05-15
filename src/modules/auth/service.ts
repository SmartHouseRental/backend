import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { Response } from 'express';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../core/AppError';
import { sendEmail } from '../../emails/emailService';
import { generateTokenPair, verifyRefreshToken } from '../../utils/jwt.utils';
import type {
  RegisterInput,
  LoginInput,
  VerifyEmailInput,
  ResendVerificationCodeInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from './schema';

const SALT_ROUNDS = 12;
const EMAIL_VERIFICATION_EXPIRY_HOURS = 1;
const PASSWORD_RESET_EXPIRY_HOURS = 1;

function generateSixDigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function createEmailVerificationToken(email: string): Promise<string> {
  return createSixDigitCodeToken(email, EMAIL_VERIFICATION_EXPIRY_HOURS);
}

async function createSixDigitCodeToken(email: string, expiryHours: number): Promise<string> {
  let token = generateSixDigitCode();
  let attempts = 0;

  while (attempts < 5) {
    const existing = await prisma.verificationToken.findUnique({ where: { token } });
    if (!existing) break;
    token = generateSixDigitCode();
    attempts += 1;
  }

  if (attempts >= 5) {
    throw new AppError('Could not generate verification code. Please try again.', 500);
  }

  const expires = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

  await prisma.verificationToken.deleteMany({ where: { identifier: email } });

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  });

  return token;
}

async function sendVerificationEmail(email: string, firstName?: string | null): Promise<void> {
  const verificationCode = await createEmailVerificationToken(email);

  await sendEmail(
    'verifyEmail',
    email,
    {
      firstName: firstName ?? 'there',
      verificationCode,
      expiryHours: EMAIL_VERIFICATION_EXPIRY_HOURS,
      supportEmail: env.SUPPORT_EMAIL ?? env.EMAIL_FROM,
    },
    'Verify your email address'
  );
}

/**
 * Set HTTP-Only cookie with refresh token
 */
export function setRefreshTokenCookie(res: Response, refreshToken: string) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

/**
 * Clear refresh token cookie
 */
export function clearRefreshTokenCookie(res: Response) {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
}

/**
 * Store refresh token in database
 */
async function storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt,
    },
  });
}

/**
 * Register new user
 */
export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError('Email already registered', 409);
  }

  const normalizedPhone = input.phone?.trim() || null;
  if (normalizedPhone) {
    const existingPhone = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
    if (existingPhone) {
      throw new AppError('Phone number already registered', 409);
    }
  }

  const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

  // Registration supports only renter/owner roles, with renter as default.
  const role = input.role ?? 'renter';

  let user;
  try {
    user = await prisma.user.create({
      data: {
        email: input.email,
        password: hashedPassword,
        first_name: input.first_name ?? null,
        last_name: input.last_name ?? null,
        phone: normalizedPhone,
        role,
      } as Prisma.UserCreateInput,
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        createdAt: true,
        emailVerified: true,
        isVerified: true,
      } as Prisma.UserSelect,
    });
  } catch (error) {
    const prismaError = error as { code?: string; meta?: { target?: string[] | string } };
    if (prismaError.code === 'P2002') {
      const target = prismaError.meta?.target;
      const fields = Array.isArray(target) ? target : target ? [target] : [];
      if (fields.includes('email')) {
        throw new AppError('Email already registered', 409);
      }
      if (fields.includes('phone')) {
        throw new AppError('Phone number already registered', 409);
      }
      throw new AppError('Duplicate value violates unique constraint', 409);
    }
    throw error;
  }

  const { isVerified, ...safeUser } = user;
  const responseUser = user.role === 'owner' ? { ...safeUser, isVerified } : safeUser;

  const { accessToken, refreshToken } = generateTokenPair(user.id, user.role);
  await storeRefreshToken(user.id, refreshToken);

  if (user.email) {
    try {
      await sendVerificationEmail(user.email, user.first_name);
    } catch (error) {
      console.warn(
        `Email verification could not be sent to ${user.email}: ${(error as Error).message}`
      );
    }
  }

  return { user: responseUser, accessToken, refreshToken };
}

/**
 * Login user with email and password
 */
export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  // Check if account has password (social login users might not)
  if (!user.password) {
    throw new AppError('Please login with your social account', 400);
  }

  const valid = await bcrypt.compare(input.password, user.password);
  if (!valid) {
    throw new AppError('Invalid email or password', 401);
  }

  if (!user.emailVerified) {
    throw new AppError('Please verify your email before logging in', 403);
  }

  const { accessToken, refreshToken } = generateTokenPair(user.id, user.role);
  await storeRefreshToken(user.id, refreshToken);

  const { password: _, ...safeUser } = user;
  return { user: safeUser, accessToken, refreshToken };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(oldRefreshToken: string) {
  // Verify the refresh token
  const decoded = verifyRefreshToken(oldRefreshToken);

  // Check if refresh token exists in database
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: oldRefreshToken },
    include: { user: true },
  });

  if (!storedToken) {
    throw new AppError('Invalid refresh token', 401);
  }

  if (storedToken.expiresAt < new Date()) {
    // Clean up expired token
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    throw new AppError('Refresh token expired', 401);
  }

  // Delete old refresh token (token rotation)
  await prisma.refreshToken.delete({ where: { id: storedToken.id } });

  // Generate new token pair
  const { accessToken, refreshToken } = generateTokenPair(
    storedToken.user.id,
    storedToken.user.role
  );

  // Store new refresh token
  await storeRefreshToken(storedToken.user.id, refreshToken);

  const { password: _, ...safeUser } = storedToken.user;
  return { user: safeUser, accessToken, refreshToken };
}

/**
 * Logout user (invalidate refresh token)
 */
export async function logout(refreshToken: string) {
  await prisma.refreshToken.deleteMany({
    where: { token: refreshToken },
  });
}

/**
 * Verify Email
 */
export async function verifyEmail(input: VerifyEmailInput) {
  const tokenRecord = await prisma.verificationToken.findUnique({
    where: { token: input.code },
  });

  if (!tokenRecord) {
    throw new AppError('Invalid verification token', 400);
  }

  if (tokenRecord.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: tokenRecord.identifier, token: input.code } },
    });
    throw new AppError('Verification token expired', 400);
  }

  const user = await prisma.user.update({
    where: { email: tokenRecord.identifier },
    data: { emailVerified: true },
    select: { id: true, email: true, emailVerified: true },
  });

  // Clean up token
  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: tokenRecord.identifier, token: input.code } },
  });

  return user;
}

/**
 * Resend email verification code
 */
export async function resendVerificationCode(input: ResendVerificationCodeInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { email: true, first_name: true, emailVerified: true },
  });

  if (!user || !user.email) {
    throw new AppError('Email not found', 404);
  }

  if (user.emailVerified) {
    throw new AppError('Email is already verified', 400);
  }

  await sendVerificationEmail(user.email, user.first_name);
}

/**
 * Forgot Password - Send Reset Code
 */
export async function forgotPassword(input: ForgotPasswordInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.email) {
    throw new AppError('Email not found', 404);
  }

  const resetCode = await createSixDigitCodeToken(user.email, PASSWORD_RESET_EXPIRY_HOURS);

  await sendEmail(
    'resetPassword',
    user.email,
    {
      firstName: user.first_name ?? 'there',
      resetCode,
      expiryHours: PASSWORD_RESET_EXPIRY_HOURS,
      supportEmail: env.SUPPORT_EMAIL ?? env.EMAIL_FROM,
    },
    'Reset your password'
  );
}

/**
 * Reset Password
 */
export async function resetPassword(input: ResetPasswordInput) {
  const tokenRecord = await prisma.verificationToken.findUnique({
    where: { token: input.code },
  });

  if (!tokenRecord) {
    throw new AppError('Invalid or expired password reset code', 400);
  }

  if (tokenRecord.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: tokenRecord.identifier, token: input.code } },
    });
    throw new AppError('Code expired', 400);
  }

  const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.update({
    where: { email: tokenRecord.identifier },
    data: { password: hashedPassword },
  });

  // Clean up token
  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: tokenRecord.identifier, token: input.code } },
  });

  return { message: 'Password reset successfully' };
}

/**
 * Get current user
 */
export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      role: true,
      createdAt: true,
      emailVerified: true,
      phone: true,
    },
  });
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return user;
}
