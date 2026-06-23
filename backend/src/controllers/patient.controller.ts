import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { admitPatientSchema } from '../validators/patient.validator';

export const admitPatient = async (req: Request, res: Response) => {
  const validation = admitPatientSchema.safeParse(req.body);
  
  if (!validation.success) {
    return res.status(400).json({ success: false, errors: validation.error.errors });
  }

  const { name, age, condition, bedId, hospitalId } = validation.data;

  try {
    const result = await prisma.$transaction(async (tx) => {// شو الترانزاكشن هنا يعني 
      const newPatient = await tx.patient.create({
        data: { name, age, condition, bedId, hospitalId }
      });

  await tx.bed.update({
        where: { id: bedId },
        data: { status: 'OCCUPIED' }
      });

      return newPatient;
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'فشل إدخال المريض', error });
  }
};

export const uploadReport = async (req: any, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded!' });
    }
    
    const { patientId } = req.body; 
    const filePath = req.file.path; 

    const record = await prisma.medicalRecord.create({
      data: { 
        patientId: patientId, 
        documentUrl: filePath 
      }
    });

    res.status(200).json({ 
      message: 'File uploaded successfully', 
      data: record 
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during upload', error });
  }
};