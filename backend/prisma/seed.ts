import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { process } from 'zod/v4/core';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  const hospital = await prisma.hospital.create({
    data: {
      name: 'Northside Regional Medical Center',
      location: 'Central District',
    },
  });
  console.log(`🏥 Created Hospital: ${hospital.name} (${hospital.id})`);

  const hashedPassword = await bcrypt.hash('Password123!', 12);

  const defaultUser = await prisma.user.create({
    data: {
      email: 'dr.rivera@curesync.com',
      password: hashedPassword,
      name: 'Dr. Rivera',
      role: 'ADMIN',
      department: 'Emergency',
      shift: 'Day',
      status: 'On Duty',
      hospitalId: hospital.id,
    },
  });
  console.log(`👤 Created Default User: ${defaultUser.name} (${defaultUser.email})`);

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error while seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });