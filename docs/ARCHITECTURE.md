# System Architecture

## Overview

The AI Inventory Management System follows a modern three-tier architecture:

1. **Presentation Layer** - React frontend with TypeScript
2. **Application Layer** - Node.js/Express REST API
3. **Data Layer** - PostgreSQL database with Prisma ORM

## Architecture Diagram

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Pages   │  │Components│  │  Store   │  │ Services │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│       │              │             │              │          │
└───────┼──────────────┼─────────────┼──────────────┼─────────┘
        │              │             │              │
        └──────────────┴─────────────┴──────────────┘
                       │ HTTP/WebSocket
        ┌──────────────┴──────────────────────────────────────┐
        │              Backend (Express)                       │
        │  ┌──────────┐  ┌────────────┐  ┌─────────────┐     │
        │  │  Routes  │─▶│Controllers │─▶│  Services   │     │
        │  └──────────┘  └────────────┘  └─────────────┘     │
        │  ┌───────────┐                                      │
        │  │Middleware │  (Auth, Validation, Error)          │
        │  └───────────┘                                      │
        └────────────────┼──────────────┼────────────────────┘
                         │              │
        ┌────────────────┘              └────────────────┐
        │                                                │
┌───────▼────────┐                              ┌───────▼────────┐
│   PostgreSQL   │                              │     Redis      │
│   (Prisma)     │                              │   (Sessions)   │
└────────────────┘                              └────────────────┘
\`\`\`

## Component Details

### Frontend Architecture

**State Management:**
- Zustand for global state (auth, user data)
- React hooks for local component state
- Context API for theme and preferences

**Routing:**
- React Router v6 for navigation
- Protected routes with authentication guards
- Role-based route access

**API Communication:**
- Axios for HTTP requests
- Socket.io-client for real-time updates
- Request/response interceptors for auth

### Backend Architecture

**Request Flow:**
1. Request → Rate Limiter
2. → CORS & Security Middleware
3. → Request Logger
4. → Route Handler
5. → Authentication Middleware
6. → Authorization Check
7. → Validation Middleware
8. → Controller
9. → Service Layer
10. → Database (Prisma)
11. → Response Formatter
12. → Error Handler

**Security Layers:**
- Helmet.js for HTTP headers
- CORS configuration
- Rate limiting per IP
- JWT token validation
- Input sanitization with Zod
- SQL injection prevention (Prisma)

### Database Schema

**Core Tables:**
- users (authentication & roles)
- products (inventory items)
- suppliers (vendor management)
- purchase_bills (invoice records)
- bill_line_items (invoice details)
- purchase_orders (procurement)
- po_line_items (order details)

**Supporting Tables:**
- chat_sessions (AI conversations)
- chat_messages (message history)
- inventory_transactions (stock movements)
- stock_alerts (notifications)

**Relationships:**
- One-to-Many: Supplier → Products
- One-to-Many: PurchaseBill → BillLineItems
- One-to-Many: Product → InventoryTransactions
- Many-to-One: Product → Supplier

## Design Patterns

### Backend Patterns

1. **MVC Architecture**
   - Models: Prisma schema
   - Views: JSON responses
   - Controllers: Route handlers

2. **Repository Pattern**
   - Prisma acts as repository layer
   - Services contain business logic
   - Controllers handle HTTP concerns

3. **Middleware Chain**
   - Authentication
   - Authorization
   - Validation
   - Error handling

4. **Factory Pattern**
   - Response formatters
   - Error creators

### Frontend Patterns

1. **Container/Presenter**
   - Pages as containers
   - Components as presenters

2. **Custom Hooks**
   - useAuth
   - useApi
   - useSocket

3. **Higher Order Components**
   - ProtectedRoute
   - withLayout

## Data Flow

### Authentication Flow

\`\`\`
User → Login Form → API → Verify Credentials
                              ↓
                         Generate JWT
                              ↓
                      Set HttpOnly Cookie
                              ↓
                      Return User Data
                              ↓
                    Update Frontend State
\`\`\`

### Product CRUD Flow

\`\`\`
User Action → Form Validation → API Request
                                      ↓
                              Auth Middleware
                                      ↓
                            Authorization Check
                                      ↓
                              Input Validation
                                      ↓
                              Controller Logic
                                      ↓
                            Database Operation
                                      ↓
                              Update Response
                                      ↓
                              Frontend Update
\`\`\`

### Real-time Updates (Phase 2+)

\`\`\`
Stock Change → Emit Socket Event → All Connected Clients
                                              ↓
                                    Update UI in Real-time
\`\`\`

## Scalability Considerations

### Horizontal Scaling
- Stateless API design
- Redis for session sharing
- Load balancer ready

### Caching Strategy
- Redis for frequent queries
- Client-side caching with React Query
- Database query optimization

### Performance
- Database indexes on foreign keys
- Pagination for large datasets
- Lazy loading on frontend
- Code splitting

## Security Measures

1. **Authentication**
   - bcrypt password hashing (10 rounds)
   - JWT with expiration
   - HttpOnly cookies

2. **Authorization**
   - Role-based access control
   - Route-level permissions
   - Resource-level checks

3. **Input Validation**
   - Zod schema validation
   - Type safety with TypeScript
   - XSS prevention

4. **API Security**
   - Rate limiting
   - CORS configuration
   - Helmet.js headers
   - SQL injection prevention

## Monitoring & Logging

**Backend Logging:**
- Winston logger
- Request/response logging
- Error tracking
- Performance metrics

**Error Handling:**
- Global error handler
- Specific error types
- Stack trace logging
- User-friendly messages

## Development Workflow

1. **Version Control**
   - Git with feature branches
   - Pull request reviews
   - Semantic versioning

2. **Testing Strategy**
   - Unit tests (Jest)
   - Integration tests
   - E2E tests (future)

3. **CI/CD**
   - GitHub Actions
   - Automated testing
   - Build verification
   - Deployment automation

## Future Enhancements

### Phase 2-3: AI Integration
- GPT-4 API integration
- Vector database for embeddings
- Conversation context management

### Phase 4: Invoice Processing
- Google Document AI
- ML model for data extraction
- Confidence scoring

### Phase 5: Advanced Features
- Microservices architecture
- Message queue (RabbitMQ)
- Advanced analytics
- Mobile app
