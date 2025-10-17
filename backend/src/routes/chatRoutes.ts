import { Router } from 'express';
import {
  getUserSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  getSessionMessages,
} from '../controllers/chatController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Session routes
router.get('/sessions', getUserSessions);
router.get('/sessions/:sessionId', getSession);
router.post('/sessions', createSession);
router.put('/sessions/:sessionId', updateSession);
router.delete('/sessions/:sessionId', deleteSession);

// Message routes
router.get('/sessions/:sessionId/messages', getSessionMessages);

export default router;
