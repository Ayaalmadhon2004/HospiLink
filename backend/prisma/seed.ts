import prisma from '../src/config/db'; 
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. إنشاء المستشفى
  const hospital = await prisma.hospital.create({
    data: {
      name: 'Northside Regional Medical Center',
      location: 'Central District',
    },
  });
  console.log(`🏥 Created Hospital: ${hospital.name} (${hospital.id})`);

  // 2. إنشاء المستخدم
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

  // 3. إنشاء السرير (تم نقله داخل دالة main)
  const bed = await prisma.bed.create({
    data: {
      bedNumber: 'ROOM-101',
      wardName: 'Emergency Ward',
      status: 'AVAILABLE',
      hospitalId: hospital.id,
    },
  });
  console.log(`🛏️ Created Bed: ${bed.bedNumber}`);

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