import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../config/logger';

// Get all chat sessions for a user
export const getUserSessions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      errorResponse(res, 'Unauthorized', 401);
      return;
    }

    const sessions = await prisma.chatSession.findMany({
      where: { userId },
      orderBy: { lastActivity: 'desc' },
      include: {
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1, // Get last message for preview
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    successResponse(res, sessions);
  } catch (error) {
    logger.error('Error fetching user sessions:', error);
    next(error);
  }
};

// Get a specific chat session with messages
export const getSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      errorResponse(res, 'Unauthorized', 401);
      return;
    }

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!session) {
      errorResponse(res, 'Session not found', 404);
      return;
    }

    if (session.userId !== userId) {
      errorResponse(res, 'Unauthorized access to session', 403);
      return;
    }

    successResponse(res, session);
  } catch (error) {
    logger.error('Error fetching session:', error);
    next(error);
  }
};

// Create a new chat session
export const createSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      errorResponse(res, 'Unauthorized', 401);
      return;
    }
    const { title } = req.body;

    const session = await prisma.chatSession.create({
      data: {
        userId,
        title: title || 'New Conversation',
      },
    });

    successResponse(res, session, '201' as any);
  } catch (error) {
    logger.error('Error creating session:', error);
    next(error);
  }
};

// Update session title
export const updateSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      errorResponse(res, 'Unauthorized', 401);
      return;
    }
    const { title } = req.body;

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      errorResponse(res, 'Session not found', 404);
      return;
    }

    if (session.userId !== userId) {
      errorResponse(res, 'Unauthorized access to session', 403);
      return;
    }

    const updatedSession = await prisma.chatSession.update({
      where: { id: sessionId },
      data: { title },
    });

    successResponse(res, updatedSession);
  } catch (error) {
    logger.error('Error updating session:', error);
    next(error);
  }
};

// Delete a chat session
export const deleteSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      errorResponse(res, 'Unauthorized', 401);
      return;
    }

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      errorResponse(res, 'Session not found', 404);
      return;
    }

    if (session.userId !== userId) {
      errorResponse(res, 'Unauthorized access to session', 403);
      return;
    }

    await prisma.chatSession.delete({
      where: { id: sessionId },
    });

    successResponse(res, { message: 'Session deleted successfully' });
  } catch (error) {
    logger.error('Error deleting session:', error);
    next(error);
  }
};

// Get messages for a session (pagination support)
export const getSessionMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      errorResponse(res, 'Unauthorized', 401);
      return;
    }
    const { limit = '50', before } = req.query;
    const limitNum = parseInt(limit as string, 10);

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      errorResponse(res, 'Session not found', 404);
      return;
    }

    if (session.userId !== userId) {
      errorResponse(res, 'Unauthorized access to session', 403);
      return;
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        sessionId,
        ...(before && {
          timestamp: {
            lt: new Date(before as string),
          },
        }),
      },
      orderBy: { timestamp: 'desc' },
      take: limitNum,
    });

    // Reverse to show oldest first
    successResponse(res, messages.reverse());
  } catch (error) {
    logger.error('Error fetching messages:', error);
    next(error);
  }
};
