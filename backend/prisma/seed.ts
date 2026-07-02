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

  // 2. Find or create user
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
    console.log(`👤 User exists: ${user.name} (${user.email})`);
  }

  // 3. Create Wards
  const wardsData = [
    { name: 'ICU Ward', floor: 1 },
    { name: 'Emergency Ward', floor: 1 },
    { name: 'Surgery Ward', floor: 2 },
    { name: 'Maternity Ward', floor: 2 },
    { name: 'General Ward', floor: 3 },
  ];

  const wards: Record<string, string> = {};

  for (const wardData of wardsData) {
    let ward = await prisma.ward.findFirst({
      where: { name: wardData.name, hospitalId: hospital.id }
    });

    if (!ward) {
      ward = await prisma.ward.create({
        data: {
          ...wardData,
          hospitalId: hospital.id,
        },
      });
      console.log(`🏥 Created Ward: ${ward.name}`);
    } else {
      console.log(`🏥 Ward exists: ${ward.name}`);
    }
    wards[wardData.name] = ward.id;
  }

  // 4. Create Beds
  const bedsData = [
    // ICU Ward
    { bedNumber: 'ICU-01', wardName: 'ICU Ward', status: 'OCCUPIED' as const },
    { bedNumber: 'ICU-02', wardName: 'ICU Ward', status: 'AVAILABLE' as const },
    { bedNumber: 'ICU-03', wardName: 'ICU Ward', status: 'CLEANING' as const },
    { bedNumber: 'ICU-04', wardName: 'ICU Ward', status: 'OCCUPIED' as const },
    { bedNumber: 'ICU-05', wardName: 'ICU Ward', status: 'OCCUPIED' as const },
    { bedNumber: 'ICU-06', wardName: 'ICU Ward', status: 'CLEANING' as const },
    { bedNumber: 'ICU-07', wardName: 'ICU Ward', status: 'OCCUPIED' as const },
    { bedNumber: 'ICU-08', wardName: 'ICU Ward', status: 'OCCUPIED' as const },
    { bedNumber: 'ICU-09', wardName: 'ICU Ward', status: 'AVAILABLE' as const },
    { bedNumber: 'ICU-10', wardName: 'ICU Ward', status: 'OCCUPIED' as const },
    { bedNumber: 'ICU-11', wardName: 'ICU Ward', status: 'OCCUPIED' as const },
    { bedNumber: 'ICU-12', wardName: 'ICU Ward', status: 'AVAILABLE' as const },
    { bedNumber: 'ICU-13', wardName: 'ICU Ward', status: 'CLEANING' as const },
    { bedNumber: 'ICU-14', wardName: 'ICU Ward', status: 'OCCUPIED' as const },
    { bedNumber: 'ICU-15', wardName: 'ICU Ward', status: 'OCCUPIED' as const },
    { bedNumber: 'ICU-16', wardName: 'ICU Ward', status: 'CLEANING' as const },

    // Emergency Ward
    { bedNumber: 'ER-01', wardName: 'Emergency Ward', status: 'AVAILABLE' as const },
    { bedNumber: 'ER-02', wardName: 'Emergency Ward', status: 'OCCUPIED' as const },
    { bedNumber: 'ER-03', wardName: 'Emergency Ward', status: 'AVAILABLE' as const },
    { bedNumber: 'ER-04', wardName: 'Emergency Ward', status: 'OCCUPIED' as const },
    { bedNumber: 'ER-05', wardName: 'Emergency Ward', status: 'CLEANING' as const },
    { bedNumber: 'ER-06', wardName: 'Emergency Ward', status: 'AVAILABLE' as const },
    { bedNumber: 'ER-07', wardName: 'Emergency Ward', status: 'OCCUPIED' as const },
    { bedNumber: 'ER-08', wardName: 'Emergency Ward', status: 'AVAILABLE' as const },

    // Surgery Ward
    { bedNumber: 'SR-01', wardName: 'Surgery Ward', status: 'OCCUPIED' as const },
    { bedNumber: 'SR-02', wardName: 'Surgery Ward', status: 'AVAILABLE' as const },
    { bedNumber: 'SR-03', wardName: 'Surgery Ward', status: 'AVAILABLE' as const },
    { bedNumber: 'SR-04', wardName: 'Surgery Ward', status: 'OCCUPIED' as const },
    { bedNumber: 'SR-05', wardName: 'Surgery Ward', status: 'CLEANING' as const },
    { bedNumber: 'SR-06', wardName: 'Surgery Ward', status: 'AVAILABLE' as const },
    { bedNumber: 'SR-07', wardName: 'Surgery Ward', status: 'OCCUPIED' as const },
    { bedNumber: 'SR-08', wardName: 'Surgery Ward', status: 'AVAILABLE' as const },
    { bedNumber: 'SR-09', wardName: 'Surgery Ward', status: 'OCCUPIED' as const },
    { bedNumber: 'SR-10', wardName: 'Surgery Ward', status: 'AVAILABLE' as const },

    // Maternity Ward
    { bedNumber: 'MT-01', wardName: 'Maternity Ward', status: 'AVAILABLE' as const },
    { bedNumber: 'MT-02', wardName: 'Maternity Ward', status: 'OCCUPIED' as const },
    { bedNumber: 'MT-03', wardName: 'Maternity Ward', status: 'AVAILABLE' as const },
    { bedNumber: 'MT-04', wardName: 'Maternity Ward', status: 'OCCUPIED' as const },
    { bedNumber: 'MT-05', wardName: 'Maternity Ward', status: 'CLEANING' as const },
    { bedNumber: 'MT-06', wardName: 'Maternity Ward', status: 'AVAILABLE' as const },
  ];

  for (const bedData of bedsData) {
    const wardId = wards[bedData.wardName];
    
    if (!wardId) {
      console.log(`❌ Ward not found for: ${bedData.wardName}`);
      continue;
    }
    
    const existing = await prisma.bed.findFirst({
      where: { 
        bedNumber: bedData.bedNumber,
        wardId: wardId 
      }
    });
    
    if (!existing) {
      await prisma.bed.create({
        data: {
          bedNumber: bedData.bedNumber,
          wardId: wardId,
          status: bedData.status,
          hospitalId: hospital.id,
        },
      });
      console.log(`🛏️ Created Bed: ${bedData.bedNumber} in ${bedData.wardName}`);
    } else {
      console.log(`🛏️ Bed exists: ${bedData.bedNumber}`);
    }
  }

  // 5. Seed Vital Thresholds (ONLY if model exists)
  try {
    console.log('🌱 Seeding vital thresholds...');

    const thresholds = [
      // Emergency department
      { department: 'Emergency', vitalType: 'HEART_RATE', minNormal: 60, maxNormal: 100, minCritical: 40, maxCritical: 140 },
      { department: 'Emergency', vitalType: 'BP_SYSTOLIC', minNormal: 90, maxNormal: 140, minCritical: 70, maxCritical: 180 },
      { department: 'Emergency', vitalType: 'BP_DIASTOLIC', minNormal: 60, maxNormal: 90, minCritical: 40, maxCritical: 110 },
      { department: 'Emergency', vitalType: 'SPO2', minNormal: 95, maxNormal: 100, minCritical: 90, maxCritical: null },
      { department: 'Emergency', vitalType: 'TEMPERATURE', minNormal: 36.1, maxNormal: 37.2, minCritical: 35, maxCritical: 39 },
      { department: 'Emergency', vitalType: 'RESPIRATORY_RATE', minNormal: 12, maxNormal: 20, minCritical: 8, maxCritical: 30 },

      // ICU department (stricter)
      { department: 'ICU', vitalType: 'HEART_RATE', minNormal: 60, maxNormal: 100, minCritical: 50, maxCritical: 120 },
      { department: 'ICU', vitalType: 'BP_SYSTOLIC', minNormal: 100, maxNormal: 140, minCritical: 80, maxCritical: 160 },
      { department: 'ICU', vitalType: 'SPO2', minNormal: 95, maxNormal: 100, minCritical: 92, maxCritical: null },
    ];

    for (const t of thresholds) {
      try {
        const existing = await (prisma as any).vitalThresholds.findUnique({
          where: { 
            department_vitalType: { 
              department: t.department, 
              vitalType: t.vitalType 
            } 
          },
        });

        if (!existing) {
          await (prisma as any).vitalThresholds.create({ data: t });
          console.log(`✅ Threshold: ${t.department} - ${t.vitalType}`);
        } else {
          console.log(`⏭️ Skipped: ${t.department} - ${t.vitalType}`);
        }
      } catch (e) {
        console.log(`⚠️ VitalThresholds model not found, skipping thresholds`);
        break;
      }
    }
  } catch (e) {
    console.log('⚠️ Skipping vital thresholds (model not ready)');
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