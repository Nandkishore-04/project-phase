# API Documentation

Base URL: `http://localhost:5000/api`

All API responses follow this format:

\`\`\`json
{
  "success": true,
  "data": { ... },
  "message": "Optional message",
  "error": "Error message if success is false"
}
\`\`\`

## Authentication

All protected endpoints require a JWT token in the Authorization header or as an httpOnly cookie.

\`\`\`
Authorization: Bearer <token>
\`\`\`

### POST /auth/register

Register a new user.

**Request Body:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "STAFF" // Optional: ADMIN, MANAGER, STAFF
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "STAFF"
    },
    "token": "jwt-token"
  }
}
\`\`\`

### POST /auth/login

Login with email and password.

**Request Body:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "password123"
}
\`\`\`

### GET /auth/me

Get current authenticated user.

**Headers:** Authorization required

## Products

### GET /products

Get all products with optional filters.

**Query Parameters:**
- `search` - Search in name, description, HSN code
- `category` - Filter by category
- `supplierId` - Filter by supplier
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "products": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 100,
      "pages": 2
    }
  }
}
\`\`\`

### POST /products

Create a new product.

**Headers:** Authorization required (ADMIN/MANAGER)

**Request Body:**
\`\`\`json
{
  "name": "Product Name",
  "description": "Description",
  "category": "Electronics",
  "hsnCode": "84713000",
  "gstRate": 18,
  "currentStock": 100,
  "reorderLevel": 10,
  "unitPrice": 5000,
  "supplierId": "supplier-id"
}
\`\`\`

### PUT /products/:id

Update a product.

**Headers:** Authorization required (ADMIN/MANAGER)

### DELETE /products/:id

Delete a product.

**Headers:** Authorization required (ADMIN)

### GET /products/low-stock

Get products with stock below reorder level.

### POST /products/stock/update

Update product stock.

**Request Body:**
\`\`\`json
{
  "productId": "product-id",
  "quantity": 10, // Positive for increase, negative for decrease
  "notes": "Manual adjustment"
}
\`\`\`

## Suppliers

### GET /suppliers

Get all suppliers.

**Query Parameters:**
- `search` - Search in name, GSTIN, email
- `activeOnly` - Filter active suppliers only (true/false)

### POST /suppliers

Create a new supplier.

**Headers:** Authorization required (ADMIN/MANAGER)

**Request Body:**
\`\`\`json
{
  "name": "Supplier Name",
  "gstin": "29ABCDE1234F1Z5",
  "email": "supplier@example.com",
  "phone": "+91-1234567890",
  "address": "Address",
  "city": "City",
  "state": "State",
  "stateCode": "29",
  "pincode": "560001",
  "rating": 4.5,
  "activeStatus": true
}
\`\`\`

## Error Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error
