// tests-int/helpers/app.ts
//
// The real routers, middleware and controllers on a real database, mounted exactly like server.ts but without the
// per-IP rate limiters (a concurrency test fires dozens of requests from one address). Sockets: getIO() works but
// has no clients here; the socket suite boots the whole server instead (sockets.int.test.ts).
import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { initIO } from '../../src/utils/socket';
import { errorEnvelope } from '../../src/utils/apiResponse';
import { errorHandler } from '../../src/middlewares/error.middleware';
import usersRoutes from '../../src/routes/users.routes';
import patientRoutes from '../../src/routes/patient.routes';
import bedRoutes from '../../src/routes/bed.routes';
import wardRoutes from '../../src/routes/ward.routes';
import vitalsRoutes from '../../src/routes/vitals.routes';
import devicesRoutes from '../../src/routes/devices.routes';
import auditLogRoutes from '../../src/routes/auditLog.routes';
import exportsRoutes from '../../src/routes/exports.routes';
import staffRoutes from '../../src/routes/staff.routes';
import appointmentRoutes from '../../src/routes/appointments.routes';
import incidentRoutes from '../../src/routes/incidents.routes';
import notificationRoutes from '../../src/routes/notifications.routes';
import { pharmacyRouter, billingRouter } from '../../src/routes/pharmacyBilling.routes';
import { notesRouter, medicationsRouter, prescriptionsRouter, labOrdersRouter } from '../../src/routes/clinical.routes';

let cached: express.Express | null = null;

export const buildApp = (): express.Express => {
  if (cached) return cached;
  initIO(http.createServer());
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(errorEnvelope);
  app.use('/api/users', usersRoutes);
  app.use('/api/patients', patientRoutes);
  app.use('/api/beds', bedRoutes);
  app.use('/api/wards', wardRoutes);
  app.use('/api/vitals', vitalsRoutes);
  app.use('/api/devices', devicesRoutes);
  app.use('/api/audit-logs', auditLogRoutes);
  app.use('/api/exports', exportsRoutes);
  app.use('/api/clinical-notes', notesRouter);
  app.use('/api/medications', medicationsRouter);
  app.use('/api/prescriptions', prescriptionsRouter);
  app.use('/api/lab-orders', labOrdersRouter);
  app.use('/api/pharmacy', pharmacyRouter);
  app.use('/api/billing', billingRouter);
  app.use('/api/staff', staffRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/incidents', incidentRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use(errorHandler);
  cached = app;
  return app;
};

type Method = 'get' | 'post' | 'put' | 'delete';

/** `call('post', '/api/x', token, body)` -> a supertest request, authenticated with the bearer header. */
export const call = (method: Method, url: string, authorization?: string, body?: object): request.Test => {
  const req = request(buildApp())[method](url);
  if (authorization) req.set('Authorization', authorization);
  return body === undefined ? req : req.send(body);
};
