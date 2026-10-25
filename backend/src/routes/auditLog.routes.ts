// backend/src/routes/auditLog.routes.ts
import { Router } from 'express';
import { protect, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { auditLogQuerySchema } from '../validators/auditLog.validator';
import { listAuditLogs, listAuditActions } from '../controllers/auditLog.controller';

const router = Router();

// The trail is read-only through the API and ADMIN-only. Reading it is not itself logged (it would flood the trail).
router.use(protect, authorize('ADMIN'));
router.get('/', validate({ query: auditLogQuerySchema }), listAuditLogs);
router.get('/actions', listAuditActions);

export default router;
