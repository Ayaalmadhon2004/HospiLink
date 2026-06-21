import { z } from 'zod';

export const admitPatientSchema = z.object({
  name: z.string().min(2, "يجب أن يكون الاسم 2 أحرف على الأقل"),
  age: z.number().int().positive("العمر يجب أن يكون رقماً موجباً"),
  condition: z.string().min(5, "يرجى كتابة وصف الحالة بشكل أوضح"),
  bedId: z.string().uuid("معرف السرير غير صالح"),
  hospitalId: z.string().uuid("معرف المستشفى غير صالح")
});