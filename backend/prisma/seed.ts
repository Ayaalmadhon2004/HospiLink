import bcrypt from 'bcryptjs';
import prisma from '../src/config/db';

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

  // 2. Find or create admin user
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

  // 3. Create Staff Members
  const staffData = [
    { name: 'Dr. Elena Mensah', email: 'elena@hospilink.com', role: 'Cardiologist', department: 'Cardiology', phone: '+1-555-0101' },
    { name: 'Dr. Anders Lindqvist', email: 'anders@hospilink.com', role: 'Intensivist', department: 'ICU', phone: '+1-555-0102' },
    { name: 'Dr. Ravi Patel', email: 'ravi@hospilink.com', role: 'Obstetrician', department: 'Maternity', phone: '+1-555-0103' },
    { name: 'Dr. Mai Nguyen', email: 'mai@hospilink.com', role: 'Pediatrician', department: 'Pediatrics', phone: '+1-555-0104' },
    { name: 'Dr. Carlos Romero', email: 'carlos@hospilink.com', role: 'Surgeon', department: 'Surgery', phone: '+1-555-0105' },
    { name: 'Dr. Jordan Carter', email: 'jordan@hospilink.com', role: 'ER Physician', department: 'Emergency', phone: '+1-555-0106' },
    { name: 'Nurse Sarah Chen', email: 'sarah@hospilink.com', role: 'Nurse', department: 'ICU', phone: '+1-555-0107' },
    { name: 'Nurse Maria Garcia', email: 'maria@hospilink.com', role: 'Nurse', department: 'Emergency', phone: '+1-555-0108' },
    { name: 'Dr. James Wilson', email: 'james@hospilink.com', role: 'Anesthesiologist', department: 'Surgery', phone: '+1-555-0109' },
    { name: 'Nurse Emily Park', email: 'emily@hospilink.com', role: 'Nurse', department: 'Maternity', phone: '+1-555-0110' },
  ];

  const createdStaff: Record<string, string> = {};

  for (const s of staffData) {
    let staff = await (prisma as any).staff.findUnique({
      where: { email: s.email }
    });

    if (!staff) {
      staff = await (prisma as any).staff.create({
        data: {
          ...s,
          isActive: true,
        },
      });
      console.log(`👨‍⚕️ Created Staff: ${staff.name} (${staff.role})`);
    } else {
      console.log(`👨‍⚕️ Staff exists: ${staff.name}`);
    }
    createdStaff[s.email] = staff.id;
  }

  // 4. Create Shifts (for TODAY)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Delete old shifts
  await (prisma as any).shift.deleteMany({
    where: {
      startTime: {
        lt: today,
      },
    },
  });
  console.log('🗑️ Deleted old shifts');

  const shiftsData = [
    { staffEmail: 'elena@hospilink.com', type: 'DAY', startHour: 8, endHour: 16, dept: 'Cardiology' },
    { staffEmail: 'anders@hospilink.com', type: 'DAY', startHour: 8, endHour: 16, dept: 'ICU' },
    { staffEmail: 'mai@hospilink.com', type: 'DAY', startHour: 8, endHour: 16, dept: 'Pediatrics' },
    { staffEmail: 'carlos@hospilink.com', type: 'DAY', startHour: 8, endHour: 16, dept: 'Surgery' },
    { staffEmail: 'sarah@hospilink.com', type: 'DAY', startHour: 8, endHour: 16, dept: 'ICU' },
    { staffEmail: 'james@hospilink.com', type: 'DAY', startHour: 6, endHour: 14, dept: 'Surgery' },
    { staffEmail: 'ravi@hospilink.com', type: 'EVENING', startHour: 16, endHour: 24, dept: 'Maternity' },
    { staffEmail: 'emily@hospilink.com', type: 'EVENING', startHour: 16, endHour: 24, dept: 'Maternity' },
    { staffEmail: 'jordan@hospilink.com', type: 'NIGHT', startHour: 0, endHour: 8, dept: 'Emergency' },
    { staffEmail: 'maria@hospilink.com', type: 'NIGHT', startHour: 0, endHour: 8, dept: 'Emergency' },
  ];

  for (const shift of shiftsData) {
    const staffId = createdStaff[shift.staffEmail];
    if (!staffId) continue;

    const startTime = new Date(today.getTime() + shift.startHour * 60 * 60 * 1000);
    const endTime = new Date(today.getTime() + shift.endHour * 60 * 60 * 1000);

    await (prisma as any).shift.create({
      data: {
        staffId,
        type: shift.type,
        startTime,
        endTime,
        department: shift.dept,
      },
    });
    console.log(`🕐 Created Shift: ${shift.type} for ${shift.staffEmail}`);
  }

  // 5. Create Patients
  const patientsData = [
    { name: 'John Smith', patientCode: 'PT-2044', department: 'General', age: 45, gender: 'MALE', diagnosis: 'General Checkup' },
    { name: 'Emma Johnson', patientCode: 'PT-2045', department: 'Emergency', age: 32, gender: 'FEMALE', diagnosis: 'Chest Pain' },
    { name: 'Michael Brown', patientCode: 'PT-2046', department: 'ICU', age: 67, gender: 'MALE', diagnosis: 'Heart Failure' },
    { name: 'Sophia Davis', patientCode: 'PT-2047', department: 'Maternity', age: 28, gender: 'FEMALE', diagnosis: 'Prenatal Care' },
    { name: 'William Wilson', patientCode: 'PT-2048', department: 'Surgery', age: 54, gender: 'MALE', diagnosis: 'Appendectomy' },
    { name: 'Olivia Martinez', patientCode: 'PT-2049', department: 'Pediatrics', age: 8, gender: 'FEMALE', diagnosis: 'Fever' },
    { name: 'James Anderson', patientCode: 'PT-2050', department: 'Cardiology', age: 71, gender: 'MALE', diagnosis: 'Hypertension' },
    { name: 'Isabella Taylor', patientCode: 'PT-2051', department: 'Emergency', age: 19, gender: 'FEMALE', diagnosis: 'Fractured Arm' },
  ];

  const createdPatients: Record<string, string> = {};

  for (const p of patientsData) {
    let patient = await prisma.patient.findUnique({
      where: { patientCode: p.patientCode }
    });

    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          ...p,
          hospitalId: hospital.id,
        },
      });
      console.log(`🧑‍⚕️ Created Patient: ${patient.name} (${patient.patientCode})`);
    } else {
      console.log(`🧑‍⚕️ Patient exists: ${patient.name}`);
    }
    createdPatients[p.patientCode] = patient.id;
  }

  // 6. Create Vitals for patients
  const vitalsData = [
    { patientCode: 'PT-2044', heartRate: 72, systolicBP: 120, diastolicBP: 80, spO2: 98, temperature: 36.5, respiratoryRate: 16 },
    { patientCode: 'PT-2045', heartRate: 95, systolicBP: 135, diastolicBP: 85, spO2: 96, temperature: 37.1, respiratoryRate: 18 },
    { patientCode: 'PT-2046', heartRate: 110, systolicBP: 150, diastolicBP: 90, spO2: 92, temperature: 38.2, respiratoryRate: 22 },
    { patientCode: 'PT-2047', heartRate: 80, systolicBP: 110, diastolicBP: 70, spO2: 99, temperature: 36.8, respiratoryRate: 14 },
    { patientCode: 'PT-2048', heartRate: 65, systolicBP: 125, diastolicBP: 78, spO2: 97, temperature: 36.4, respiratoryRate: 15 },
  ];

  for (const v of vitalsData) {
    const patientId = createdPatients[v.patientCode];
    if (!patientId) continue;

    const existing = await (prisma as any).patientVitals.findFirst({
      where: { patientId },
      orderBy: { recordedAt: 'desc' },
    });

    if (!existing) {
      await (prisma as any).patientVitals.create({
        data: {
          patientId,
          heartRate: v.heartRate,
          systolicBP: v.systolicBP,
          diastolicBP: v.diastolicBP,
          spO2: v.spO2,
          temperature: v.temperature,
          respiratoryRate: v.respiratoryRate,
          recordedBy: user.id,
          isCritical: v.heartRate > 100 || v.systolicBP > 140 || v.spO2 < 95 || v.temperature > 37.5,
        },
      });
      console.log(`📊 Created Vitals for ${v.patientCode}`);
    }
  }

  // 7. Create Wards
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

  // 8. Create Beds
  const bedsData = [
    { bedNumber: 'ICU-01', wardName: 'ICU Ward', status: 'OCCUPIED' as const },
    { bedNumber: 'ICU-02', wardName: 'ICU Ward', status: 'AVAILABLE' as const },
    { bedNumber: 'ICU-03', wardName: 'ICU Ward', status: 'CLEANING' as const },
    { bedNumber: 'ER-01', wardName: 'Emergency Ward', status: 'AVAILABLE' as const },
    { bedNumber: 'ER-02', wardName: 'Emergency Ward', status: 'OCCUPIED' as const },
    { bedNumber: 'SR-01', wardName: 'Surgery Ward', status: 'OCCUPIED' as const },
    { bedNumber: 'SR-02', wardName: 'Surgery Ward', status: 'AVAILABLE' as const },
    { bedNumber: 'MT-01', wardName: 'Maternity Ward', status: 'AVAILABLE' as const },
    { bedNumber: 'MT-02', wardName: 'Maternity Ward', status: 'OCCUPIED' as const },
  ];

  for (const bedData of bedsData) {
    const wardId = wards[bedData.wardName];
    if (!wardId) continue;

    const existing = await prisma.bed.findFirst({
      where: { bedNumber: bedData.bedNumber, wardId }
    });

    if (!existing) {
      await prisma.bed.create({
        data: {
          bedNumber: bedData.bedNumber,
          wardId,
          status: bedData.status,
          hospitalId: hospital.id,
        },
      });
      console.log(`🛏️ Created Bed: ${bedData.bedNumber}`);
    }
  }

  // ✅ 9. CREATE APPOINTMENTS (for TODAY)
  console.log('📅 Creating appointments...');
  
  const appointmentsData = [
    { 
      patientCode: 'PT-2044', 
      staffEmail: 'elena@hospilink.com', 
      type: 'CONSULTATION', 
      scheduledAt: new Date(today.getTime() + 8 * 60 * 60 * 1000), // 8:00 AM
      duration: 30, 
      department: 'Cardiology', 
      room: 'C-214', 
      status: 'SCHEDULED' 
    },
    { 
      patientCode: 'PT-2045', 
      staffEmail: 'carlos@hospilink.com', 
      type: 'SURGERY', 
      scheduledAt: new Date(today.getTime() + 9 * 60 * 60 * 1000), // 9:00 AM
      duration: 60, 
      department: 'Surgery', 
      room: 'OR-3', 
      status: 'SCHEDULED' 
    },
    { 
      patientCode: 'PT-2046', 
      staffEmail: 'elena@hospilink.com', 
      type: 'IMAGING', 
      scheduledAt: new Date(today.getTime() + 10 * 60 * 60 * 1000), // 10:00 AM
      duration: 45, 
      department: 'Cardiology', 
      room: 'RAD-1', 
      status: 'SCHEDULED' 
    },
    { 
      patientCode: 'PT-2047', 
      staffEmail: 'ravi@hospilink.com', 
      type: 'FOLLOW_UP', 
      scheduledAt: new Date(today.getTime() + 11 * 60 * 60 * 1000), // 11:00 AM
      duration: 30, 
      department: 'Maternity', 
      room: 'M-119', 
      status: 'SCHEDULED' 
    },
    { 
      patientCode: 'PT-2048', 
      staffEmail: 'carlos@hospilink.com', 
      type: 'SURGERY', 
      scheduledAt: new Date(today.getTime() + 13 * 60 * 60 * 1000), // 1:00 PM
      duration: 90, 
      department: 'Surgery', 
      room: 'OR-1', 
      status: 'SCHEDULED' 
    },
  ];

  for (const apt of appointmentsData) {
    const patientId = createdPatients[apt.patientCode];
    const doctorId = createdStaff[apt.staffEmail];
    
    if (!patientId || !doctorId) {
      console.log(`⚠️ Skipping appointment: patient=${apt.patientCode} or doctor=${apt.staffEmail} not found`);
      continue;
    }

    const existing = await prisma.appointment.findFirst({
      where: {
        patientId,
        doctorId,
        scheduledAt: apt.scheduledAt,
      },
    });

    if (!existing) {
      await prisma.appointment.create({
        data: {
          patientId,
          doctorId,
          scheduledAt: apt.scheduledAt,
          type: apt.type,
          status: apt.status,
          department: apt.department,
          room: apt.room,
          duration: apt.duration,
        },
      });
      console.log(`📅 Created Appointment: ${apt.type} for ${apt.patientCode} at ${apt.scheduledAt.toLocaleTimeString()}`);
    } else {
      console.log(`📅 Appointment exists: ${apt.type} for ${apt.patientCode}`);
    }
  }

  console.log('✅ Seeding completed successfully!');

   const incidentsData = [
    {
      code: 'INC-0091',
      title: 'Multi-vehicle collision — Highway 9',
      description: 'Mass casualty event involving 12 vehicles',
      type: 'MASS_CASUALTY',
      severity: 'CRITICAL',
      status: 'ACTIVE',
      location: 'ER Bay 1-3',
      teams: 4,
      progress: 62,
      triageLevel: 'RED',
      reportedBy: 'EMS-001',
    },
    {
      code: 'INC-0092',
      title: 'Industrial chemical exposure',
      description: 'Chlorine gas leak at manufacturing plant',
      type: 'CHEMICAL',
      severity: 'CRITICAL',
      status: 'ACTIVE',
      location: 'Decon Unit',
      teams: 3,
      progress: 40,
      triageLevel: 'RED',
      reportedBy: 'HazMat-01',
    },
    {
      code: 'INC-0093',
      title: 'Structure fire — residential block',
      description: 'Apartment complex fire with multiple casualties',
      type: 'FIRE',
      severity: 'ELEVATED',
      status: 'ACTIVE',
      location: 'Triage Tent A',
      teams: 2,
      progress: 75,
      triageLevel: 'YELLOW',
      reportedBy: 'Fire-03',
    },
  ];

    for (const inc of incidentsData) {
    const existing = await prisma.incident.findUnique({
      where: { code: inc.code },
    });

    if (!existing) {
      await prisma.incident.create({ data: inc });
      console.log(`🚨 Created Incident: ${inc.code} — ${inc.title}`);
    } else {
      console.log(`🚨 Incident exists: ${inc.code}`);
    }
  }
const units = await prisma.dispatchUnit.createMany({
    data: [
      {
        unitCode: 'AMB-04',
        unitType: 'AMBULANCE',
        status: 'EN_ROUTE',
        department: 'ER',
        crew: ['Crew Alpha'],
        eta: 4,
      },
      {
        unitCode: 'AMB-09',
        unitType: 'AMBULANCE',
        status: 'ON_SCENE',
        department: 'ER',
        crew: ['Crew Bravo'],
      },
      {
        unitCode: 'AMB-12',
        unitType: 'AMBULANCE',
        status: 'AVAILABLE',
        department: 'ER',
        crew: ['Crew Charlie'],
      },
      {
        unitCode: 'PAR-01',
        unitType: 'PARAMEDIC',
        status: 'AVAILABLE',
        department: 'ICU',
        crew: ['Paramedic Smith'],
      },
    ],
  });

  // إنشاء نداءات
  const calls = await prisma.dispatchCall.createMany({
    data: [
      {
        type: 'Cardiac arrest',
        location: '14 Elm St',
        priority: 'CRITICAL',
        status: 'ASSIGNED',
      },
      {
        type: 'MVC',
        location: 'Highway 9 mile 22',
        priority: 'HIGH',
        status: 'ASSIGNED',
      },
    ],
  });

  console.log('✅ Dispatch seed data created');
}

main()
  .catch((e) => {
    console.error('❌ Error while seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });