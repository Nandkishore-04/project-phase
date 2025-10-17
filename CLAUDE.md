# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-Powered Inventory Management System - A full-stack application with conversational AI interface and invoice processing capabilities. Final year CSE project (10 weeks).

**Current Status:** Phase 1 Complete ✅

## Tech Stack

- **Frontend:** React 18 + TypeScript + Tailwind CSS + Vite
- **Backend:** Node.js + Express + TypeScript + Socket.io
- **Database:** PostgreSQL + Prisma ORM
- **Cache:** Redis
- **AI:** OpenAI GPT-4 (Phase 3), Google Document AI (Phase 4)

## Project Structure

\`\`\`
Inventory/
├── backend/          # Express API (Port 5000)
│   ├── src/
│   │   ├── config/       # DB, Redis, Logger
│   │   ├── controllers/  # Route handlers
│   │   ├── middleware/   # Auth, validation, errors
│   │   ├── routes/       # API endpoints
│   │   ├── utils/        # Helpers, JWT, validation
│   │   └── index.ts      # Server entry
│   ├── prisma/
│   │   └── schema.prisma # Database schema
│   └── database/
│       └── seed.ts       # Sample data
├── frontend/         # React app (Port 5173)
│   ├── src/
│   │   ├── components/   # Reusable UI
│   │   ├── pages/        # Route pages
│   │   ├── services/     # API, Socket
│   │   ├── store/        # Zustand state
│   │   └── types/        # TypeScript types
└── docs/            # Documentation
\`\`\`

## Quick Commands

### Development
\`\`\`bash
# Start PostgreSQL & Redis
docker-compose up -d postgres redis

# Backend (Terminal 1)
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run dev

# Frontend (Terminal 2)
cd frontend
npm install
npm run dev
\`\`\`

### Database Operations
\`\`\`bash
cd backend
npx prisma studio          # Open DB GUI
npx prisma migrate dev     # Create migration
npx prisma db seed         # Seed data
npx prisma migrate reset   # Reset DB
\`\`\`

### Testing
\`\`\`bash
cd backend && npm test     # Backend tests
cd frontend && npm test    # Frontend tests
\`\`\`

## Architecture Highlights

### Authentication Flow
- JWT tokens in httpOnly cookies
- Role-based access (ADMIN, MANAGER, STAFF)
- Middleware: `authenticate` and `authorize(roles)`
- bcrypt password hashing (10 rounds)

### API Structure
- Routes → Middleware → Controller → Service → Prisma
- Zod validation schemas in `utils/validation.ts`
- Consistent response format via `utils/response.ts`
- Error handling in `middleware/errorHandler.ts`

### Frontend Patterns
- Zustand for auth state (`store/authStore.ts`)
- Protected routes with `ProtectedRoute` component
- API client in `services/api.ts` with interceptors
- Layout wrapper with sidebar navigation

### Database Schema (11 models)
Key models: User, Product, Supplier, PurchaseBill, BillLineItem, PurchaseOrder, ChatSession, InventoryTransaction, StockAlert

Relationships:
- Supplier → Products (1:many)
- Product → StockAlerts (1:many)
- PurchaseBill → BillLineItems (1:many)

## Key Features Implemented (Phase 1)

1. **Authentication:** Register, login, logout, JWT tokens
2. **Products:** CRUD, search, filters, low stock alerts, categories
3. **Suppliers:** CRUD, search, GSTIN validation
4. **Dashboard:** Stats, low stock widget, quick actions
5. **UI:** Dark mode, responsive, Tailwind components

## Common Development Tasks

### Adding a new API endpoint
1. Define validation schema in `backend/src/utils/validation.ts`
2. Create controller in `backend/src/controllers/`
3. Add route in `backend/src/routes/`
4. Update `backend/src/index.ts` to include route
5. Add API method in `frontend/src/services/api.ts`

### Adding a new page
1. Create page component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`
3. Update sidebar menu in `frontend/src/components/Layout.tsx`

### Database changes
1. Modify `backend/prisma/schema.prisma`
2. Run `npx prisma migrate dev --name description`
3. Update seed file if needed: `backend/database/seed.ts`
4. Regenerate Prisma client: `npx prisma generate`
5. Update TypeScript types in `frontend/src/types/index.ts`

## Important Notes

- Never commit `.env` file - use `.env.example` template
- Always validate inputs with Zod schemas
- Use Prisma transactions for multi-table operations
- Frontend API calls should handle errors with try-catch
- Toast notifications for user feedback (react-hot-toast)
- All authenticated routes need `authenticate` middleware
- Protected actions need `authorize(['ADMIN', 'MANAGER'])`

## Default Credentials

- Admin: admin@inventory.com / admin123
- Manager: manager@inventory.com / manager123

## Troubleshooting

- **Port 5432 in use:** Another PostgreSQL running
- **Prisma errors:** Run `npx prisma generate`
- **Module not found:** Delete node_modules and reinstall
- **DB connection:** Check DATABASE_URL in .env
- **Redis errors:** Ensure Redis is running on port 6379

## Next Phases

**Phase 2 (Week 3-4):** Socket.io chat, message history, real-time updates
**Phase 3 (Week 5-6):** OpenAI integration, NLP queries, PO via chat
**Phase 4 (Week 7-8):** Invoice OCR, GSTIN validation, batch processing
**Phase 5 (Week 9-10):** Analytics, forecasting, deployment

## File Naming Conventions

- Backend: camelCase (productController.ts)
- Frontend: PascalCase for components (ProductCard.tsx)
- Types: PascalCase (User, Product)
- Utils: camelCase (formatDate.ts)
- Routes: kebab-case URLs (/api/products/low-stock)

## Git Workflow

- Main branch: `master` (production ready)
- Feature branches: `feature/description`
- Commit format: `type: description` (feat, fix, refactor, docs)

For detailed documentation, see:
- README.md - Setup and overview
- docs/API.md - API endpoints
- docs/ARCHITECTURE.md - System design
- docs/SETUP_GUIDE.md - Quick start
