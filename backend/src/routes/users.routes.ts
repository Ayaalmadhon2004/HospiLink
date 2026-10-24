// backend/src/routes/users.routes.ts
import { Router } from 'express';
import { protect, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { logActivity } from '../middlewares/audit.middleware';
import { idParams } from '../validators/common.validator';
import { inviteUserSchema, approveUserSchema, listUsersQuerySchema } from '../validators/user.validator';
import { listUsers, inviteUser, approveUser, rejectUser, deactivateUser, resetUserTwoFactor } from '../controllers/users.controller';

const router = Router();

// Account administration is ADMIN-only.
router.use(protect, authorize('ADMIN'));

router.get('/', validate({ query: listUsersQuerySchema }), listUsers);
router.post('/', validate({ body: inviteUserSchema }), logActivity('INVITE_USER'), inviteUser);
router.put('/:id/approve', validate({ params: idParams, body: approveUserSchema }), logActivity('APPROVE_USER'), approveUser);
router.put('/:id/reject', validate({ params: idParams }), logActivity('REJECT_USER'), rejectUser);
router.put('/:id/deactivate', validate({ params: idParams }), logActivity('DEACTIVATE_USER'), deactivateUser);
router.post('/:id/2fa/reset', validate({ params: idParams }), logActivity('RESET_2FA'), resetUserTwoFactor);

export default router;
