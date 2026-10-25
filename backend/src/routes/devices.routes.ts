// backend/src/routes/devices.routes.ts
import { Router } from 'express';
import { protect, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { logActivity } from '../middlewares/audit.middleware';
import { idParams } from '../validators/common.validator';
import { createDeviceKeySchema } from '../validators/devices.validator';
import { createDeviceKey, listDeviceKeys, revokeDeviceKey } from '../controllers/devices.controller';

const router = Router();

// Device credentials are ADMIN-only.
router.use(protect, authorize('ADMIN'));
router.get('/', listDeviceKeys);
router.post('/', validate({ body: createDeviceKeySchema }), logActivity('CREATE_DEVICE_KEY'), createDeviceKey);
router.delete('/:id', validate({ params: idParams }), logActivity('REVOKE_DEVICE_KEY'), revokeDeviceKey);

export default router;
