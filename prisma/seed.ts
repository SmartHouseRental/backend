import 'dotenv/config';
/// <reference types="node" />
import {
  PrismaClient,
  Role,
  PropertyType,
  PropertyStatus,
  UserStatus,
  VerificationState,
  AgreementStatus,
  PaymentStatus,
  ReportStatus,
  ReportTargetType,
  VerificationStatus,
  ReviewStatus,
  AppointmentStatus,
  NotificationType,
  MessageStatus,
  MessageType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Password123!';

function textPair(en: string, am: string) {
  return { en, am };
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

function addMinutes(date: Date, minutes: number) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function appointmentSlot(daysAhead: number, startHour: number, durationMinutes = 45) {
  const start = daysFromNow(daysAhead);
  start.setHours(startHour, 0, 0, 0);
  return {
    startsAt: start,
    endsAt: addMinutes(start, durationMinutes),
  };
}

async function main() {
  console.log('Seeding database...');

  // Cleanup in dependency-safe order
  await prisma.messageReaction.deleteMany();
  await prisma.messageAttachment.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.verificationDocument.deleteMany();
  await prisma.report.deleteMany();
  await prisma.agreement.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.property.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.user.deleteMany();

  // 1) Users
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@smartrental.com',
      password: passwordHash,
      first_name: 'Super',
      last_name: 'Admin',
      phone: '+251 900 000 000',
      role: Role.admin,
      emailVerified: true,
      isVerified: true,
      verificationState: VerificationState.verified,
      status: UserStatus.active,
    },
  });

  const owner1 = await prisma.user.create({
    data: {
      email: 'michael.c@example.com',
      password: passwordHash,
      first_name: 'Michael',
      last_name: 'Chen',
      phone: '+251 911 111 111',
      role: Role.owner,
      emailVerified: true,
      isVerified: true,
      verificationState: VerificationState.verified,
      status: UserStatus.active,
      image: 'https://i.pravatar.cc/150?u=michael',
    },
  });

  const owner2 = await prisma.user.create({
    data: {
      email: 'sarah.j@example.com',
      password: passwordHash,
      first_name: 'Sarah',
      last_name: 'Jenkins',
      phone: '+251 922 222 222',
      role: Role.owner,
      emailVerified: true,
      isVerified: false,
      verificationState: VerificationState.pending,
      status: UserStatus.active,
      image: 'https://i.pravatar.cc/150?u=sarah',
    },
  });

  const owner3 = await prisma.user.create({
    data: {
      email: 'david.v@example.com',
      password: passwordHash,
      first_name: 'David',
      last_name: 'Vance',
      phone: '+251 933 333 333',
      role: Role.owner,
      emailVerified: true,
      isVerified: false,
      verificationState: VerificationState.resubmit,
      status: UserStatus.suspended,
      image: 'https://i.pravatar.cc/150?u=david',
    },
  });

  const owner4 = await prisma.user.create({
    data: {
      email: 'mulugeta.a@example.com',
      password: passwordHash,
      first_name: 'Mulugeta',
      last_name: 'Abebe',
      phone: '+251 911 234 567',
      role: Role.owner,
      emailVerified: false,
      isVerified: false,
      verificationState: VerificationState.pending,
      status: UserStatus.active,
    },
  });

  const owner5 = await prisma.user.create({
    data: {
      email: 'dawit.m@email.com',
      password: passwordHash,
      first_name: 'Dawit',
      last_name: 'Mekonnen',
      phone: '+251 91 234 5678',
      role: Role.owner,
      emailVerified: true,
      isVerified: true,
      verificationState: VerificationState.verified,
      status: UserStatus.active,
      location: 'Addis Ababa, Ethiopia',
      bio: 'Property owner with 5+ years of experience managing residential rentals in Addis Ababa. Specializing in premium villas and modern apartments.',
      image: 'https://cdn.example.com/avatars/dawit.jpg',
    },
  });

  const renter1 = await prisma.user.create({
    data: {
      email: 'dawit.g@example.com',
      password: passwordHash,
      first_name: 'Dawit',
      last_name: 'Gebre',
      phone: '+251 944 444 444',
      role: Role.renter,
      emailVerified: true,
      isVerified: true,
      verificationState: VerificationState.verified,
      status: UserStatus.active,
      image: 'https://i.pravatar.cc/150?u=dawit',
    },
  });

  const renter2 = await prisma.user.create({
    data: {
      email: 'hana.b@example.com',
      password: passwordHash,
      first_name: 'Hana',
      last_name: 'Bekele',
      phone: '+251 955 555 555',
      role: Role.renter,
      emailVerified: true,
      isVerified: true,
      verificationState: VerificationState.verified,
      status: UserStatus.active,
      image: 'https://i.pravatar.cc/150?u=hana',
    },
  });

  const renter3 = await prisma.user.create({
    data: {
      email: 'liya.t@example.com',
      password: passwordHash,
      first_name: 'Liya',
      last_name: 'Teklu',
      phone: '+251 966 666 666',
      role: Role.renter,
      emailVerified: false,
      isVerified: false,
      verificationState: VerificationState.pending,
      status: UserStatus.active,
    },
  });

  console.log('Created Users');

  // 1b) User preferences aligned with the recommendation endpoint payload
  const renter1Preference = {
    preferredLocations: [
      {
        city: textPair('Seattle', 'ሲያትል'),
        region: textPair('Washington', 'ዋሽንግተን'),
        lat: 47.6062,
        lng: -122.3321,
      },
    ],
    budget: { min: 800, max: 1600, currency: 'ETB' },
    bedrooms: { min: 1, max: 2 },
    bathrooms: { min: 1, max: 2 },
    amenities: ['parking', 'wifi', 'dishwasher'],
    furnishStatus: 'unfunished' as const,
    notes: textPair('Prefer quiet buildings near transit', 'በትራንስፖርት አቅራቢያ ጸጥ ያሉ ህንፃዎችን እመርጣለሁ'),
    preferredPropertyType: textPair('Villa', 'ቪላ'),
    locale: 'en',
    supportedLocales: ['en', 'am'],
  };

  await prisma.userPreference.create({
    data: {
      userId: renter1.id,
      preferredPriceMin: renter1Preference.budget.min,
      preferredPriceMax: renter1Preference.budget.max,
      preferredBedrooms: renter1Preference.bedrooms.min,
      preferredLocations: renter1Preference.preferredLocations.map(
        (location) => `${location.city.en}, ${location.region.en}`
      ),
      preferredAmenities: renter1Preference.amenities,
      preferredType: PropertyType.VILLA,
    },
  });

  const renter2Preference = {
    preferredLocations: [
      {
        city: textPair('Kazanchis', 'ካዛንቺስ'),
        region: textPair('Addis Ababa', 'አዲስ አበባ'),
        lat: 8.9955,
        lng: 38.7898,
      },
    ],
    budget: { min: 12000, max: 28000, currency: 'ETB' },
    bedrooms: { min: 2, max: 2 },
    bathrooms: { min: 1, max: 1 },
    amenities: ['wifi', 'elevator', 'backup power'],
    furnishStatus: 'semiFurnished' as const,
    notes: textPair('Prefers walkable neighborhoods', 'በእግር የሚደርሱ አካባቢዎችን ይመርጣል'),
    preferredPropertyType: textPair('Apartment', 'አፓርትመንት'),
    locale: 'en',
    supportedLocales: ['en', 'am'],
  };

  await prisma.userPreference.create({
    data: {
      userId: renter2.id,
      preferredPriceMin: renter2Preference.budget.min,
      preferredPriceMax: renter2Preference.budget.max,
      preferredBedrooms: renter2Preference.bedrooms.min,
      preferredLocations: renter2Preference.preferredLocations.map(
        (location) => `${location.city.en}, ${location.region.en}`
      ),
      preferredAmenities: renter2Preference.amenities,
      preferredType: PropertyType.APARTMENT,
    },
  });

  console.log('Created User Preferences');

  // 2) Auth-supporting records
  await prisma.account.createMany({
    data: [
      {
        userId: owner1.id,
        type: 'oauth',
        provider: 'google',
        providerAccountId: `google-${owner1.id}`,
      },
      {
        userId: renter1.id,
        type: 'oauth',
        provider: 'google',
        providerAccountId: `google-${renter1.id}`,
      },
    ],
  });

  await prisma.session.createMany({
    data: [
      {
        userId: admin.id,
        sessionToken: crypto.randomUUID(),
        expires: daysFromNow(7),
      },
      {
        userId: owner1.id,
        sessionToken: crypto.randomUUID(),
        expires: daysFromNow(7),
      },
    ],
  });

  await prisma.refreshToken.createMany({
    data: [
      {
        userId: admin.id,
        token: crypto.randomUUID(),
        expiresAt: daysFromNow(14),
      },
      {
        userId: renter1.id,
        token: crypto.randomUUID(),
        expiresAt: daysFromNow(14),
      },
    ],
  });

  await prisma.verificationToken.create({
    data: {
      identifier: renter3.email ?? 'liya.t@example.com',
      token: crypto.randomUUID(),
      expires: daysFromNow(1),
    },
  });

  console.log('Created Auth records');

  // 3) Verification documents — one record per user, admin reviews all at once
  await prisma.verificationDocument.createMany({
    data: [
      {
        // owner2 (Sarah) — submitted front + back, pending admin review
        userId: owner2.id,
        frontUrl: 'https://example.com/docs/sarah-national-id-front.jpg',
        backUrl: 'https://example.com/docs/sarah-national-id-back.jpg',
        status: VerificationStatus.pending,
      },
      {
        // owner3 (David) — needs to resubmit
        userId: owner3.id,
        frontUrl: 'https://example.com/docs/david-national-id-front.jpg',
        backUrl: 'https://example.com/docs/david-national-id-back.jpg',
        livePhotoUrl: 'https://example.com/docs/david-national-id-live.jpg',
        status: VerificationStatus.resubmit,
      },
      {
        // owner4 (Mulugeta) — only front submitted, pending
        userId: owner4.id,
        frontUrl: 'https://example.com/docs/mulugeta-national-id-front.jpg',
        status: VerificationStatus.pending,
      },
      {
        // owner5 (Dawit) — fully verified with all three docs
        userId: owner5.id,
        frontUrl: 'national-id-front-2026.pdf',
        backUrl: 'national-id-back-2026.pdf',
        livePhotoUrl: 'owner-photo-2026.jpg',
        status: VerificationStatus.approved,
        submittedAt: new Date('2026-03-15T10:00:00.000Z'),
      },
    ],
  });

  // 3b) Profile related records for Dawit
  await prisma.bankDetail.create({
    data: {
      userId: owner5.id,
      bankName: 'Commercial Bank of Ethiopia',
      accountNumber: '1000123456784521',
      holderName: 'Dawit Mekonnen',
      branch: 'Bole Branch',
    },
  });

  await prisma.notificationPreference.create({
    data: {
      userId: owner5.id,
      appointments: true,
      agreements: true,
      payments: true,
      reviews: false,
      reports: true,
      system: false,
    },
  });

  console.log('Created Verification Docs');

  // 4) Properties
  const prop1 = await prisma.property.create({
    data: {
      ownerId: owner1.id,
      title: textPair('Horizon Peak Villa', 'ሆራይዘን ፒክ ቪላ'),
      description: textPair(
        'A beautiful villa overlooking the city with modern amenities.',
        'ዘመናዊ አገልግሎቶች ያሉት ከተማን የሚመለከት ቪላ።'
      ),
      location: 'POINT(38.7636 8.9806)',
      address: 'Bole, Addis Ababa',
      type: PropertyType.VILLA,
      status: PropertyStatus.PENDING,
      price: 45000,
      amenities: ['WiFi', 'Parking', 'CCTV', 'Balcony'],
      images: ['https://example.com/properties/horizon.jpg'],
      videos: ['https://example.com/properties/horizon-tour.mp4'],
      bedrooms: 4,
      bathrooms: 3,
      area: 250,
      furnishingType: 'furnished',
      rentTerms: {
        minDuration: '6',
        minMonths: 6,
        secureDeposit: 45000,
        currency: 'ETB',
        petsAllowed: false,
        conditions: {
          en: '6 months minimum, first and last month upfront',
          am: 'ቢያንስ 6 ወር፣ የመጀመሪያ እና የመጨረሻ ወር ቅድሚያ ክፍያ',
        },
      },
    },
  });

  const prop2 = await prisma.property.create({
    data: {
      ownerId: owner2.id,
      title: textPair('Urban Loft 42', 'ከተማ ሎፍት 42'),
      description: textPair(
        'Modern loft in the heart of Addis with walkable services.',
        'በአዲስ አበባ መሀል የሚገኝ ዘመናዊ ሎፍት።'
      ),
      location: 'POINT(38.7612 9.0167)',
      address: 'Kazanchis, Addis Ababa',
      type: PropertyType.APARTMENT,
      status: PropertyStatus.AVAILABLE,
      price: 25000,
      amenities: ['WiFi', 'Elevator', 'Backup Power'],
      images: ['https://example.com/properties/loft.jpg'],
      bedrooms: 2,
      bathrooms: 1,
      area: 90,
      furnishingType: 'semi-furnished',
      rentTerms: {
        minDuration: '3',
        minMonths: 3,
        secureDeposit: 25000,
        currency: 'ETB',
        conditions: {
          en: '3 months minimum, first month upfront',
          am: 'ቢያንስ 3 ወር፣ የመጀመሪያ ወር ቅድሚያ',
        },
      },
    },
  });

  const prop3 = await prisma.property.create({
    data: {
      ownerId: owner3.id,
      title: textPair('Suspicious Listing', 'አስጠራጣሪ ማስታወቂያ'),
      description: textPair(
        'Cheap house listing with inconsistent details.',
        'ዝርዝሮቹ የማይጣጣሙ ዝቅተኛ ዋጋ ቤት ማስታወቂያ።'
      ),
      location: 'POINT(38.8470 9.0100)',
      address: 'Megenagna, Addis Ababa',
      type: PropertyType.HOUSE,
      status: PropertyStatus.UNAVAILABLE,
      price: 5000,
      amenities: [],
      images: [],
      bedrooms: 1,
      bathrooms: 1,
      area: 50,
      rentTerms: {
        minDuration: '1',
        minMonths: 1,
        secureDeposit: 5000,
        currency: 'ETB',
        conditions: {
          en: '1 month minimum',
          am: 'ቢያንስ 1 ወር',
        },
      },
    },
  });

  const prop4 = await prisma.property.create({
    data: {
      ownerId: owner1.id,
      title: textPair('Cottage by the Lake', 'የሐይቅ ዳር ኮተጅ'),
      description: textPair(
        'Perfect family home close to the lake and parks.',
        'ከሐይቅና ፓርኮች አቅራቢያ የሚገኝ ለቤተሰብ ተስማሚ ቤት።'
      ),
      location: 'POINT(38.4795 7.0570)',
      address: 'Hawassa',
      type: PropertyType.HOUSE,
      status: PropertyStatus.RENTED,
      price: 15000,
      amenities: ['Garden', 'Water Tank'],
      images: ['https://example.com/properties/cottage.jpg'],
      bedrooms: 3,
      bathrooms: 2,
      area: 120,
      rentTerms: {
        minDuration: '12',
        minMonths: 12,
        secureDeposit: 15000,
        currency: 'ETB',
        conditions: {
          en: '12 months minimum, negotiable for long-term leases',
          am: 'ቢያንስ 12 ወር፣ ረጅም ጊዜ ኪራይ ከሆነ ይከናወናል',
        },
      },
    },
  });

  const prop5 = await prisma.property.create({
    data: {
      ownerId: owner4.id,
      title: textPair('Sunset Studio', 'ሰንሴት ስቱዲዮ'),
      description: textPair(
        'Affordable studio for single professionals.',
        'ለነጠላ ሰራተኞች ተመጣጣኝ ዋጋ ያለው ስቱዲዮ።'
      ),
      location: 'POINT(38.7485 9.0302)',
      address: 'CMC, Addis Ababa',
      type: PropertyType.STUDIO,
      status: PropertyStatus.AVAILABLE,
      price: 12000,
      amenities: ['WiFi'],
      images: ['https://example.com/properties/studio.jpg'],
      bedrooms: 1,
      bathrooms: 1,
      area: 45,
      rentTerms: {
        minDuration: '3',
        minMonths: 3,
        secureDeposit: 12000,
        currency: 'ETB',
        conditions: {
          en: '3 months minimum, first month deposit',
          am: 'ቢያንስ 3 ወር፣ የመጀመሪያ ወር ቅድሚያ',
        },
      },
    },
  });

  console.log('Created Properties');

  // 5) Conversations + Messages + Attachments + Reactions (Messaging endpoints)
  const conversation1 = await prisma.conversation.create({
    data: {
      propertyId: prop1.id,
      ownerId: owner1.id,
      renterId: renter1.id,
    },
  });

  const conversation2 = await prisma.conversation.create({
    data: {
      propertyId: prop2.id,
      ownerId: owner2.id,
      renterId: renter2.id,
    },
  });

  const conversation3 = await prisma.conversation.create({
    data: {
      propertyId: prop5.id,
      ownerId: owner4.id,
      renterId: renter3.id,
    },
  });

  const message1 = await prisma.message.create({
    data: {
      conversationId: conversation1.id,
      senderId: renter1.id,
      type: MessageType.TEXT,
      content: 'Hi, is Horizon Peak Villa still available this week?',
      status: MessageStatus.DELIVERED,
    },
  });

  const message2 = await prisma.message.create({
    data: {
      conversationId: conversation1.id,
      senderId: owner1.id,
      type: MessageType.TEXT,
      content: 'Yes, it is available. We can schedule a visit tomorrow.',
      replyToId: message1.id,
      status: MessageStatus.READ,
    },
  });

  const message3 = await prisma.message.create({
    data: {
      conversationId: conversation2.id,
      senderId: renter2.id,
      type: MessageType.IMAGE,
      content: 'Sharing my document preview',
      status: MessageStatus.SENT,
      attachments: {
        create: {
          url: '/uploads/sample-lease-proof.jpg',
          fileName: 'sample-lease-proof.jpg',
          mimeType: 'image/jpeg',
          fileSize: 182431,
        },
      },
    },
  });

  await prisma.messageReaction.createMany({
    data: [
      { messageId: message1.id, userId: owner1.id, emoji: '👍' },
      { messageId: message2.id, userId: renter1.id, emoji: '✅' },
      { messageId: message3.id, userId: owner2.id, emoji: '👀' },
    ],
  });

  await prisma.conversation.updateMany({
    where: { id: { in: [conversation1.id, conversation2.id, conversation3.id] } },
    data: { updatedAt: new Date() },
  });

  console.log('Created Messaging data');

  // 6) Appointments
  const slotPending = appointmentSlot(2, 10, 30);
  const slotConfirmed = appointmentSlot(3, 14, 45);
  const slotCancelled = appointmentSlot(5, 9, 30);
  const slotDeclined = appointmentSlot(1, 16, 60);
  const slotPastConfirmed = appointmentSlot(-2, 11, 45);

  const appointment1 = await prisma.appointment.create({
    data: {
      propertyId: prop1.id,
      renterId: renter1.id,
      ownerId: owner1.id,
      startsAt: slotPending.startsAt,
      endsAt: slotPending.endsAt,
      status: AppointmentStatus.PENDING,
      note: 'Please confirm if parking is available.',
    },
  });

  const appointment2 = await prisma.appointment.create({
    data: {
      propertyId: prop2.id,
      renterId: renter2.id,
      ownerId: owner2.id,
      startsAt: slotConfirmed.startsAt,
      endsAt: slotConfirmed.endsAt,
      status: AppointmentStatus.ACCEPTED,
      note: 'Will arrive with family member.',
    },
  });

  const appointment3 = await prisma.appointment.create({
    data: {
      propertyId: prop5.id,
      renterId: renter3.id,
      ownerId: owner4.id,
      startsAt: slotCancelled.startsAt,
      endsAt: slotCancelled.endsAt,
      status: AppointmentStatus.REJECTED,
      note: 'Rescheduling due to work.',
    },
  });

  const appointment4 = await prisma.appointment.create({
    data: {
      propertyId: prop1.id,
      renterId: renter2.id,
      ownerId: owner1.id,
      startsAt: slotDeclined.startsAt,
      endsAt: slotDeclined.endsAt,
      status: AppointmentStatus.REJECTED,
      note: 'Requested slot conflicts with owner travel plans.',
    },
  });

  const appointment5 = await prisma.appointment.create({
    data: {
      propertyId: prop4.id,
      renterId: renter1.id,
      ownerId: owner1.id,
      startsAt: slotPastConfirmed.startsAt,
      endsAt: slotPastConfirmed.endsAt,
      status: AppointmentStatus.ACCEPTED,
      note: 'Visited and discussed lease terms.',
    },
  });

  console.log('Created Appointments');

  // 7) Agreements
  const ag1 = await prisma.agreement.create({
    data: {
      propertyId: prop1.id,
      renterId: renter1.id,
      ownerId: owner1.id,
      monthlyRent: 45000,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-04-01'),
      status: AgreementStatus.active,
      paymentStatus: PaymentStatus.confirmed,
    },
  });

  const ag2 = await prisma.agreement.create({
    data: {
      propertyId: prop2.id,
      renterId: renter2.id,
      ownerId: owner2.id,
      monthlyRent: 25000,
      startDate: new Date('2026-05-01'),
      endDate: new Date('2027-05-01'),
      status: AgreementStatus.pending_owner,
      paymentStatus: PaymentStatus.pending,
    },
  });

  const ag3 = await prisma.agreement.create({
    data: {
      propertyId: prop4.id,
      renterId: renter1.id,
      ownerId: owner1.id,
      monthlyRent: 15000,
      startDate: new Date('2025-03-01'),
      endDate: new Date('2026-03-01'),
      status: AgreementStatus.expired,
      paymentStatus: PaymentStatus.confirmed,
    },
  });

  // additional sample agreements to populate owner dashboards
  const ag4 = await prisma.agreement.create({
    data: {
      propertyId: prop5.id,
      renterId: renter3.id,
      ownerId: owner4.id,
      monthlyRent: 12000,
      startDate: new Date('2026-02-01'),
      endDate: new Date('2027-02-01'),
      status: AgreementStatus.pending_owner,
      paymentStatus: PaymentStatus.pending,
    },
  });

  const ag5 = await prisma.agreement.create({
    data: {
      propertyId: prop2.id,
      renterId: renter2.id,
      ownerId: owner2.id,
      monthlyRent: 25000,
      startDate: new Date('2026-06-01'),
      endDate: new Date('2027-06-01'),
      status: AgreementStatus.pending_renter,
      paymentStatus: PaymentStatus.pending,
    },
  });

  console.log('Created Agreements');

  // 7.5) Payments
  // Create several payments with richer fields to match schema (stripeId, currency, proofUrl)
  await prisma.payment.createMany({
    data: [
      // ag1: first month - confirmed via stripe
      {
        agreementId: ag1.id,
        amount: 45000,
        currency: 'ETB',
        status: PaymentStatus.confirmed,
        paidAt: new Date('2026-04-05'),
        confirmedAt: new Date('2026-04-06'),
        stripeId: crypto.randomUUID(),
      },
      // ag1: second month - proof uploaded but not yet confirmed
      {
        agreementId: ag1.id,
        amount: 45000,
        currency: 'ETB',
        status: PaymentStatus.proof_uploaded,
        paidAt: new Date('2026-05-05'),
        proofUrl: 'https://example.com/proofs/may-payment.jpg',
        stripeId: crypto.randomUUID(),
      },
      // ag1: third month - pending (no proof yet)
      {
        agreementId: ag1.id,
        amount: 45000,
        currency: 'ETB',
        status: PaymentStatus.pending,
        paidAt: new Date('2026-06-05'),
      },
      // ag2: initial pending payment
      {
        agreementId: ag2.id,
        amount: 25000,
        currency: 'ETB',
        status: PaymentStatus.pending,
        paidAt: new Date(),
      },
      // ag3: historical confirmed payment
      {
        agreementId: ag3.id,
        amount: 15000,
        currency: 'ETB',
        status: PaymentStatus.confirmed,
        paidAt: new Date('2025-12-05'),
        confirmedAt: new Date('2025-12-06'),
        stripeId: crypto.randomUUID(),
      },
      // ag4: proof uploaded awaiting confirmation
      {
        agreementId: ag4.id,
        amount: 12000,
        currency: 'ETB',
        status: PaymentStatus.proof_uploaded,
        paidAt: new Date('2026-02-02'),
        proofUrl: 'https://example.com/proofs/ag4-feb-payment.jpg',
        stripeId: crypto.randomUUID(),
      },
      // ag5: pending initial payment
      {
        agreementId: ag5.id,
        amount: 25000,
        currency: 'ETB',
        status: PaymentStatus.pending,
        paidAt: new Date(),
      },
    ],
  });

  console.log('Created Payments');

  // 8) Reports
  await prisma.report.createMany({
    data: [
      {
        reportedById: renter1.id,
        targetId: owner3.id,
        targetType: ReportTargetType.user,
        category: 'fraud',
        description: 'Owner tried to increase rent mid-lease and refused maintenance.',
        status: ReportStatus.in_review,
      },
      {
        reportedById: renter2.id,
        targetId: prop3.id,
        targetType: ReportTargetType.property,
        category: 'false_advertising',
        description: 'Property does not exist at the location.',
        status: ReportStatus.open,
      },
      {
        reportedById: admin.id,
        targetId: ag1.id,
        targetType: ReportTargetType.agreement,
        category: 'document_mismatch',
        description: 'Manual review required for uploaded payment document.',
        status: ReportStatus.resolved,
      },
    ],
  });

  console.log('Created Reports');

  // 9) Reviews
  await prisma.review.createMany({
    data: [
      {
        reviewerId: renter1.id,
        propertyId: prop1.id,
        rating: 5,
        comment: 'Outstanding property! Exceeded all expectations.',
        status: ReviewStatus.published,
      },
      {
        reviewerId: renter2.id,
        propertyId: prop2.id,
        rating: 4,
        comment: 'Great location and reasonable price.',
        status: ReviewStatus.published,
      },
      {
        reviewerId: renter3.id,
        propertyId: prop5.id,
        rating: 4,
        comment: 'Compact and practical for one person.',
        status: ReviewStatus.published,
      },
      {
        reviewerId: renter1.id,
        propertyId: prop3.id,
        rating: 1,
        comment: 'Listing information looked inaccurate during inspection.',
        status: ReviewStatus.flagged,
      },
      {
        reviewerId: admin.id,
        propertyId: prop4.id,
        rating: 1,
        comment: 'Spam-style review removed by moderation.',
        status: ReviewStatus.removed,
      },
    ],
  });

  console.log('Created Reviews');

  // 10) Notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: admin.id,
        type: NotificationType.MESSAGE_NEW,
        title: 'New document submission',
        body: 'Mulugeta Abebe submitted documents for verification.',
        payload: { verificationState: 'pending_documents' },
      },
      {
        userId: admin.id,
        type: NotificationType.MESSAGE_NEW,
        title: 'Fraud report filed',
        body: 'Report against suspicious listing requires review.',
        payload: { reportCategory: 'fraud' },
      },
      {
        userId: renter1.id,
        type: NotificationType.APPOINTMENT_BOOKED,
        title: 'Agreement activated',
        body: 'Your agreement for Horizon Peak Villa is now active.',
        payload: { agreementPropertyId: prop1.id },
      },
      {
        userId: renter2.id,
        type: NotificationType.APPOINTMENT_UPDATED,
        title: 'Visit confirmed',
        body: 'Your visit appointment was confirmed.',
        payload: { appointmentId: appointment2.id },
        readAt: new Date(),
      },
    ],
  });

  console.log('Created Notifications');

  // 11) Audit logs
  await prisma.auditLog.createMany({
    data: [
      {
        actorId: admin.id,
        eventType: 'USER_SUSPENDED',
        entityType: 'User',
        entityId: owner3.id,
        metadata: { reason: 'Multiple fraud reports' },
      },
      {
        actorId: admin.id,
        eventType: 'PROPERTY_APPROVED',
        entityType: 'Property',
        entityId: prop4.id,
        metadata: {},
      },
      {
        actorId: renter1.id,
        eventType: 'APPOINTMENT_BOOKED',
        entityType: 'Appointment',
        entityId: appointment1.id,
        metadata: { propertyId: prop1.id },
      },
      {
        actorId: owner1.id,
        eventType: 'APPOINTMENT_STATUS_UPDATED',
        entityType: 'Appointment',
        entityId: appointment4.id,
        metadata: { status: 'REJECTED' },
      },
      {
        actorId: owner1.id,
        eventType: 'APPOINTMENT_NOTE_UPDATED',
        entityType: 'Appointment',
        entityId: appointment5.id,
        metadata: { note: 'Visited and discussed lease terms.' },
      },
      {
        actorId: renter2.id,
        eventType: 'MESSAGE_SENT',
        entityType: 'Message',
        entityId: message3.id,
        metadata: { conversationId: conversation2.id, type: 'IMAGE' },
      },
    ],
  });

  console.log('Created Audit Logs');
  console.log('Seeding Complete!');
  console.log('----------------------------------------');
  console.log('Default password for all users:', DEFAULT_PASSWORD);
  console.log('Admin email:', admin.email);
  console.log('Owner email:', owner1.email);
  console.log('Renter email:', renter1.email);
  console.log('Sample conversation IDs:');
  console.log(' -', conversation1.id);
  console.log(' -', conversation2.id);
  console.log(' -', conversation3.id);
  console.log('Sample message IDs:');
  console.log(' -', message1.id);
  console.log(' -', message2.id);
  console.log(' -', message3.id);
  console.log('----------------------------------------');
}

main()
  .catch((e) => {
    console.error('Seeding Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
