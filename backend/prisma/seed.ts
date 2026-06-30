import prisma from '../src/config/db';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Find or create hospital
  let hospital = await prisma.hospital.findFirst();
  
  if (!hospital) {
    hospital = await prisma.hospital.create({
      data: {
        name: 'Northside Regional Medical Center',
        location: 'Central District',
      },
    });
    console.log(`🏥 Created Hospital: ${hospital.name} (${hospital.id})`);
  } else {
    console.log(`🏥 Found Hospital: ${hospital.name} (${hospital.id})`);
  }

  // 2. Find or create user (skip if exists)
  let user = await prisma.user.findUnique({
    where: { email: 'dr.rivera@curesync.com' }
  });

  if (!user) {
    const hashedPassword = await bcrypt.hash('Password123!', 12);
    user = await prisma.user.create({
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
    console.log(`👤 Created User: ${user.name} (${user.email})`);
  } else {
    console.log(`👤 User already exists: ${user.name} (${user.email})`);
  }

  // 3. Create multiple beds (skip if already exist)
  const bedData = [
    { bedNumber: '101', wardName: 'ICU', status: 'AVAILABLE' as const, hospitalId: hospital.id },
    { bedNumber: '102', wardName: 'ICU', status: 'AVAILABLE' as const, hospitalId: hospital.id },
    { bedNumber: '201', wardName: 'Emergency', status: 'AVAILABLE' as const, hospitalId: hospital.id },
    { bedNumber: '301', wardName: 'General', status: 'AVAILABLE' as const, hospitalId: hospital.id },
    { bedNumber: '302', wardName: 'General', status: 'OCCUPIED' as const, hospitalId: hospital.id },
  ];

  for (const bed of bedData) {
    const existing = await prisma.bed.findFirst({
      where: { bedNumber: bed.bedNumber }
    });
    
    if (!existing) {
      await prisma.bed.create({ data: bed });
      console.log(`🛏️ Created Bed: ${bed.bedNumber}`);
    } else {
      console.log(`🛏️ Bed exists: ${bed.bedNumber}`);
    }
  }

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