// prisma/seed.e2e.ts
// Minimal, deterministic data for the real-backend E2E suite (frontend/e2e-real).
// Idempotent. Only ever run it against a throwaway database (see docs/E2E_REAL.md).
import bcrypt from 'bcryptjs';
import prisma from '../src/config/db';

const BCRYPT_ROUNDS = 12;
const AGE_FIRST_PATIENT = 45;
const AGE_SECOND_PATIENT = 32;

export const E2E_ADMIN = { email: 'e2e.admin@hospilink.test', password: 'E2e-Password-123!' };

// Role accounts for the RBAC flows. Their department matches the seeded patients' "General" so department-scoped
// notifications (critical lab results) reach them.
export const E2E_DOCTOR = { email: 'e2e.doctor@hospilink.test', password: 'E2e-Password-123!', name: 'E2E Doctor', role: 'DOCTOR' as const };
export const E2E_NURSE = { email: 'e2e.nurse@hospilink.test', password: 'E2e-Password-123!', name: 'E2E Nurse', role: 'NURSE' as const };
export const E2E_PHARMACIST = { email: 'e2e.pharmacist@hospilink.test', password: 'E2e-Password-123!', name: 'E2E Pharmacist', role: 'PHARMACIST' as const };
export const E2E_BILLING = { email: 'e2e.billing@hospilink.test', password: 'E2e-Password-123!', name: 'E2E Billing', role: 'BILLING' as const };

// Codes deliberately sit outside the PT-20xx range that POST /patients/admit generates
// (see "Known issues" in CLAUDE.md about the count-based patientCode).
const SEED_PATIENTS = [
  { patientCode: 'E2E-0001', name: 'Seeded Patient One', age: AGE_FIRST_PATIENT, gender: 'MALE' as const, department: 'General', diagnosis: 'Seeded checkup' },
  { patientCode: 'E2E-0002', name: 'Seeded Patient Two', age: AGE_SECOND_PATIENT, gender: 'FEMALE' as const, department: 'Emergency', diagnosis: 'Seeded chest pain' },
];

// Fixed id so the seed stays idempotent (frontend/e2e-real/notification-bell.e2e.ts looks for this title).
export const SEED_NOTIFICATION = {
  id: '00000000-0000-4000-8000-0000000000e2',
  type: 'SYSTEM',
  title: 'Seeded unread notification',
  message: 'Seeded message for the bell',
};

async function main(): Promise<void> {
  const hospital =
    (await prisma.hospital.findFirst()) ??
    (await prisma.hospital.create({ data: { name: 'E2E Test Hospital', location: 'Test District', code: 'E2E-TEST' } }));

  const admin = await prisma.user.upsert({
    where: { email: E2E_ADMIN.email },
    update: {},
    create: {
      email: E2E_ADMIN.email,
      password: await bcrypt.hash(E2E_ADMIN.password, BCRYPT_ROUNDS),
      name: 'E2E Admin',
      role: 'ADMIN',
      department: 'Emergency',
      shift: 'DAY',
      status: 'ON_DUTY',
      emailVerifiedAt: new Date(),
      hospitalId: hospital.id,
    },
  });

  for (const u of [E2E_DOCTOR, E2E_NURSE, E2E_PHARMACIST, E2E_BILLING]) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        password: await bcrypt.hash(u.password, BCRYPT_ROUNDS),
        name: u.name,
        role: u.role,
        department: 'General',
        shift: 'DAY',
        status: 'ON_DUTY',
        emailVerifiedAt: new Date(),
        hospitalId: hospital.id,
      },
    });
  }

  // One unread notification for the admin (the bell badge shows 1 on a fresh database).
  await prisma.notification.upsert({
    where: { id: SEED_NOTIFICATION.id },
    update: {},
    create: { ...SEED_NOTIFICATION, userId: admin.id },
  });

  await Promise.all(
    SEED_PATIENTS.map((p) =>
      prisma.patient.upsert({
        where: { patientCode: p.patientCode },
        update: {},
        create: { ...p, hospitalId: hospital.id },
      }),
    ),
  );
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
