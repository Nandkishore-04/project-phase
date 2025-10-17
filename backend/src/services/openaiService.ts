import OpenAI from 'openai';
import logger from '../config/logger';
import prisma from '../config/database';
import { createHash } from 'crypto';
import redisClient from '../config/redis';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Check if OpenAI is configured
const isConfigured = !!process.env.OPENAI_API_KEY;

// Configuration for enhanced features
const CACHE_TTL = 3600; // 1 hour cache for common queries
const MAX_CONTEXT_MESSAGES = 15; // Increased from 10 for better context
const CONTEXT_SUMMARY_THRESHOLD = 20; // Summarize after 20 messages
const CONFIDENCE_THRESHOLD = 0.85; // Minimum confidence for auto-execution

// Function definitions for OpenAI function calling
const functions: OpenAI.Chat.Completions.ChatCompletionCreateParams.Function[] = [
  {
    name: 'search_products',
    description: 'Search for products in the inventory by name, description, HSN code, or category. Returns matching products with details.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (product name, description, or HSN code)',
        },
        category: {
          type: 'string',
          description: 'Filter by product category (optional)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_low_stock_products',
    description: 'Get all products that are currently below their reorder level (low stock or out of stock)',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 20)',
        },
      },
    },
  },
  {
    name: 'get_product_stock',
    description: 'Get detailed stock information for a specific product by name',
    parameters: {
      type: 'object',
      properties: {
        productName: {
          type: 'string',
          description: 'Name of the product to check',
        },
      },
      required: ['productName'],
    },
  },
  {
    name: 'calculate_inventory_value',
    description: 'Calculate the total value of all inventory in stock',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'search_suppliers',
    description: 'Search for suppliers by name or list all active suppliers',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Supplier name to search for (optional - if not provided, lists all)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 20)',
        },
      },
    },
  },
  {
    name: 'get_products_by_category',
    description: 'Get all products in a specific category',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Category name',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 20)',
        },
      },
      required: ['category'],
    },
  },
  {
    name: 'create_purchase_order',
    description: 'Create a new purchase order for products from a supplier',
    parameters: {
      type: 'object',
      properties: {
        supplierName: {
          type: 'string',
          description: 'Name of the supplier',
        },
        products: {
          type: 'array',
          description: 'List of products to order',
          items: {
            type: 'object',
            properties: {
              productName: {
                type: 'string',
                description: 'Name of the product',
              },
              quantity: {
                type: 'number',
                description: 'Quantity to order',
              },
            },
            required: ['productName', 'quantity'],
          },
        },
        notes: {
          type: 'string',
          description: 'Additional notes for the purchase order (optional)',
        },
      },
      required: ['supplierName', 'products'],
    },
  },
  {
    name: 'recommend_suppliers',
    description: 'Get supplier recommendations for specific product types or categories based on ratings and product availability',
    parameters: {
      type: 'object',
      properties: {
        productType: {
          type: 'string',
          description: 'Type of product or category to find suppliers for',
        },
      },
      required: ['productType'],
    },
  },
];

// Function implementations
async function searchProducts(query: string, category?: string, limit: number = 10) {
  const products = await prisma.product.findMany({
    where: {
      AND: [
        {
          OR: [
            { name: { contains: query } },
            { description: { contains: query } },
            { hsnCode: { contains: query } },
          ],
        },
        category ? { category: { contains: category } } : {},
      ],
    },
    include: {
      supplier: true,
    },
    take: limit,
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    currentStock: p.currentStock,
    reorderLevel: p.reorderLevel,
    unitPrice: p.unitPrice,
    supplier: p.supplier?.name || 'N/A',
    hsnCode: p.hsnCode,
  }));
}

async function getLowStockProducts(limit: number = 20) {
  const products = await prisma.product.findMany({
    where: {
      currentStock: {
        lte: prisma.product.fields.reorderLevel,
      },
    },
    include: {
      supplier: true,
    },
    orderBy: {
      currentStock: 'asc',
    },
    take: limit,
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    currentStock: p.currentStock,
    reorderLevel: p.reorderLevel,
    unitPrice: p.unitPrice,
    supplier: p.supplier?.name || 'N/A',
    category: p.category,
  }));
}

async function getProductStock(productName: string) {
  const product = await prisma.product.findFirst({
    where: {
      name: { contains: productName },
    },
    include: {
      supplier: true,
    },
  });

  if (!product) {
    return { error: 'Product not found' };
  }

  return {
    name: product.name,
    currentStock: product.currentStock,
    reorderLevel: product.reorderLevel,
    unitPrice: product.unitPrice,
    category: product.category,
    supplier: product.supplier?.name || 'N/A',
    status:
      product.currentStock === 0
        ? 'OUT_OF_STOCK'
        : product.currentStock <= product.reorderLevel
        ? 'LOW_STOCK'
        : 'IN_STOCK',
  };
}

async function calculateInventoryValue() {
  const products = await prisma.product.findMany({
    select: {
      currentStock: true,
      unitPrice: true,
      name: true,
      category: true,
    },
  });

  const totalValue = products.reduce((sum, p) => sum + p.currentStock * p.unitPrice, 0);
  const totalItems = products.reduce((sum, p) => sum + p.currentStock, 0);

  return {
    totalProducts: products.length,
    totalItems,
    totalValue,
    formattedValue: `₹${totalValue.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
  };
}

async function searchSuppliers(query?: string, limit: number = 20) {
  const suppliers = await prisma.supplier.findMany({
    where: query
      ? {
          name: { contains: query },
          activeStatus: 1,
        }
      : {
          activeStatus: 1,
        },
    include: {
      products: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      rating: 'desc',
    },
    take: limit,
  });

  return suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    city: s.city,
    state: s.state,
    gstin: s.gstin,
    rating: s.rating,
    productCount: s.products.length,
    products: s.products.map((p) => p.name),
  }));
}

async function getProductsByCategory(category: string, limit: number = 20) {
  const products = await prisma.product.findMany({
    where: {
      category: { contains: category },
    },
    include: {
      supplier: true,
    },
    take: limit,
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    currentStock: p.currentStock,
    unitPrice: p.unitPrice,
    supplier: p.supplier?.name || 'N/A',
  }));
}

async function createPurchaseOrder(
  supplierName: string,
  products: Array<{ productName: string; quantity: number }>,
  notes?: string,
  userId?: string
) {
  // Find supplier
  const supplier = await prisma.supplier.findFirst({
    where: { name: { contains: supplierName } },
  });

  if (!supplier) {
    return { error: `Supplier "${supplierName}" not found` };
  }

  // Validate and find all products
  const productDetails = await Promise.all(
    products.map(async (item) => {
      const product = await prisma.product.findFirst({
        where: {
          name: { contains: item.productName },
          supplierId: supplier.id,
        },
      });

      if (!product) {
        return {
          error: `Product "${item.productName}" not found or not supplied by ${supplierName}`,
        };
      }

      return {
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.unitPrice,
        total: item.quantity * product.unitPrice,
      };
    })
  );

  // Check for errors
  const errors = productDetails.filter((p) => 'error' in p);
  if (errors.length > 0) {
    return { errors: errors.map((e: any) => e.error) };
  }

  // Calculate total
  const totalAmount = productDetails.reduce((sum: number, p: any) => sum + p.total, 0);

  // Generate PO number
  const poNumber = `PO-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

  // Create purchase order
  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      supplierId: supplier.id,
      totalAmount,
      status: 'DRAFT',
      createdBy: userId || 'system',
      notes: notes || `AI-generated purchase order for ${products.length} items`,
      lineItems: {
        create: productDetails.map((p: any) => ({
          productId: p.productId,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          total: p.total,
        })),
      },
    },
    include: {
      supplier: true,
      lineItems: {
        include: {
          product: true,
        },
      },
    },
  });

  return {
    success: true,
    poNumber: purchaseOrder.poNumber,
    supplier: purchaseOrder.supplier.name,
    totalAmount: purchaseOrder.totalAmount,
    itemCount: purchaseOrder.lineItems.length,
    status: purchaseOrder.status,
    items: purchaseOrder.lineItems.map((item) => ({
      product: item.product.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
  };
}

async function recommendSuppliers(productType: string) {
  const suppliers = await prisma.supplier.findMany({
    where: {
      activeStatus: 1,
      products: {
        some: {
          OR: [
            { category: { contains: productType } },
            { name: { contains: productType } },
          ],
        },
      },
    },
    include: {
      products: {
        where: {
          OR: [
            { category: { contains: productType } },
            { name: { contains: productType } },
          ],
        },
        select: {
          id: true,
          name: true,
          category: true,
          currentStock: true,
        },
      },
    },
    orderBy: {
      rating: 'desc',
    },
    take: 5,
  });

  return suppliers.map((s) => ({
    name: s.name,
    rating: s.rating,
    city: s.city,
    state: s.state,
    email: s.email,
    phone: s.phone,
    matchingProducts: s.products.length,
    products: s.products.map((p) => p.name),
  }));
}

// Execute function based on function call
async function executeFunction(
  functionName: string,
  functionArgs: any,
  userId?: string
): Promise<any> {
  try {
    switch (functionName) {
      case 'search_products':
        return await searchProducts(
          functionArgs.query,
          functionArgs.category,
          functionArgs.limit
        );

      case 'get_low_stock_products':
        return await getLowStockProducts(functionArgs.limit);

      case 'get_product_stock':
        return await getProductStock(functionArgs.productName);

      case 'calculate_inventory_value':
        return await calculateInventoryValue();

      case 'search_suppliers':
        return await searchSuppliers(functionArgs.query, functionArgs.limit);

      case 'get_products_by_category':
        return await getProductsByCategory(functionArgs.category, functionArgs.limit);

      case 'create_purchase_order':
        return await createPurchaseOrder(
          functionArgs.supplierName,
          functionArgs.products,
          functionArgs.notes,
          userId
        );

      case 'recommend_suppliers':
        return await recommendSuppliers(functionArgs.productType);

      default:
        return { error: `Unknown function: ${functionName}` };
    }
  } catch (error) {
    logger.error(`Error executing function ${functionName}:`, error);
    return { error: `Failed to execute ${functionName}` };
  }
}

/**
 * Generate cache key for AI responses
 */
function generateCacheKey(userMessage: string, userId?: string): string {
  const data = `${userId || 'anonymous'}:${userMessage.toLowerCase().trim()}`;
  return `ai:cache:${createHash('md5').update(data).digest('hex')}`;
}

/**
 * Get cached AI response
 */
async function getCachedResponse(cacheKey: string): Promise<any | null> {
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      logger.info('Cache hit for AI response', { cacheKey });
      return JSON.parse(cached);
    }
  } catch (error) {
    logger.warn('Redis cache read failed, continuing without cache', { error });
  }
  return null;
}

/**
 * Cache AI response
 */
async function cacheResponse(cacheKey: string, response: any): Promise<void> {
  try {
    await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(response));
    logger.info('Cached AI response', { cacheKey, ttl: CACHE_TTL });
  } catch (error) {
    logger.warn('Failed to cache response', { error });
  }
}

/**
 * Summarize conversation context when it gets too long
 */
async function summarizeContext(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'Summarize the following conversation history concisely, preserving key details about products, orders, and user requests.',
        },
        {
          role: 'user',
          content: messages.map((m) => `${m.role}: ${m.content}`).join('\n'),
        },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    return response.choices[0].message.content || '';
  } catch (error) {
    logger.error('Failed to summarize context', { error });
    return 'Previous conversation context...';
  }
}

/**
 * Prepare conversation context with intelligent summarization
 */
async function prepareContext(
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
): Promise<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>> {
  if (conversationHistory.length <= CONTEXT_SUMMARY_THRESHOLD) {
    return conversationHistory.slice(-MAX_CONTEXT_MESSAGES);
  }

  // Summarize older messages, keep recent ones
  const recentMessages = conversationHistory.slice(-MAX_CONTEXT_MESSAGES);
  const oldMessages = conversationHistory.slice(0, -MAX_CONTEXT_MESSAGES);

  if (oldMessages.length > 0) {
    const summary = await summarizeContext(oldMessages);
    return [
      { role: 'system', content: `Previous conversation summary: ${summary}` },
      ...recentMessages,
    ];
  }

  return recentMessages;
}

// Main chat completion function
export async function getAIResponse(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [],
  userId?: string
): Promise<{ response: string; functionCalls?: any[]; cached?: boolean }> {
  if (!isConfigured) {
    // Fallback to regex parser if OpenAI is not configured
    return {
      response:
        "OpenAI API is not configured. Please add your API key to the .env file to enable AI-powered responses. For now, try using simple commands like 'help', 'show low stock', or 'search product [name]'.",
    };
  }

  // Check cache for common queries (only for queries without conversation history)
  if (conversationHistory.length === 0) {
    const cacheKey = generateCacheKey(userMessage, userId);
    const cachedResponse = await getCachedResponse(cacheKey);
    if (cachedResponse) {
      return { ...cachedResponse, cached: true };
    }
  }

  try {
    // Prepare optimized context with summarization
    const optimizedHistory = await prepareContext(conversationHistory);

    // Build messages array with context
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are an AI assistant for an inventory management system. You help users manage their inventory, search for products, create purchase orders, and get insights about stock levels.

Current capabilities:
- Search products and check stock levels
- Find low stock items and out-of-stock products
- Calculate inventory value and analytics
- Search and recommend suppliers based on ratings
- Create purchase orders automatically
- Filter products by category
- Provide intelligent insights and recommendations

Guidelines:
- Be helpful, concise, and professional
- Use available functions to get accurate real-time data
- Format responses with bullet points or tables for clarity
- Provide actionable recommendations
- Acknowledge when data is cached vs real-time
- Suggest follow-up actions when appropriate

Always prioritize accuracy and user needs.`,
      },
      ...optimizedHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      })),
      {
        role: 'user',
        content: userMessage,
      },
    ];

    // Call OpenAI with function calling
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages,
      functions,
      function_call: 'auto',
      temperature: 0.7,
      max_tokens: 1000,
    });

    const assistantMessage = response.choices[0].message;

    // Check if AI wants to call a function
    if (assistantMessage.function_call) {
      const functionName = assistantMessage.function_call.name;
      const functionArgs = JSON.parse(assistantMessage.function_call.arguments || '{}');

      logger.info(`AI calling function: ${functionName}`, { args: functionArgs });

      // Execute the function
      const functionResult = await executeFunction(functionName, functionArgs, userId);

      // Call OpenAI again with the function result
      const secondResponse = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          ...messages,
          {
            role: 'assistant',
            content: assistantMessage.content || '',
            function_call: assistantMessage.function_call,
          },
          {
            role: 'function',
            name: functionName,
            content: JSON.stringify(functionResult),
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const result = {
        response: secondResponse.choices[0].message.content || 'No response generated',
        functionCalls: [{ name: functionName, arguments: functionArgs, result: functionResult }],
      };

      // Cache successful responses (only for simple queries)
      if (conversationHistory.length === 0 && !functionResult.error) {
        const cacheKey = generateCacheKey(userMessage, userId);
        await cacheResponse(cacheKey, result);
      }

      return result;
    }

    // No function call, return direct response
    const result = {
      response: assistantMessage.content || 'No response generated',
    };

    // Cache simple informational responses
    if (conversationHistory.length === 0) {
      const cacheKey = generateCacheKey(userMessage, userId);
      await cacheResponse(cacheKey, result);
    }

    return result;
  } catch (error: any) {
    logger.error('OpenAI API error:', error);

    if (error.code === 'invalid_api_key') {
      return {
        response:
          'Invalid OpenAI API key. Please check your configuration and try again.',
      };
    }

    if (error.code === 'rate_limit_exceeded') {
      return {
        response:
          'AI service is currently busy. Please try again in a moment.',
      };
    }

    if (error.code === 'context_length_exceeded') {
      logger.warn('Context length exceeded, clearing old messages');
      return {
        response:
          'The conversation history is too long. Starting fresh - please repeat your question.',
      };
    }

    return {
      response:
        'Sorry, I encountered an error processing your request. Please try again or use simpler commands.',
    };
  }
}

/**
 * Streaming AI response for real-time chat experience
 */
export async function getAIResponseStream(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [],
  userId?: string,
  onToken?: (token: string) => void,
  onComplete?: (fullResponse: string) => void
): Promise<{ response: string; functionCalls?: any[] }> {
  if (!isConfigured) {
    const fallbackResponse =
      "OpenAI API is not configured. Please add your API key to enable AI features.";
    if (onToken) onToken(fallbackResponse);
    if (onComplete) onComplete(fallbackResponse);
    return { response: fallbackResponse };
  }

  try {
    const optimizedHistory = await prepareContext(conversationHistory);

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are a helpful AI assistant for inventory management. Be concise and accurate.`,
      },
      ...optimizedHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      })),
      {
        role: 'user',
        content: userMessage,
      },
    ];

    const stream = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages,
      functions,
      function_call: 'auto',
      temperature: 0.7,
      max_tokens: 1000,
      stream: true,
    });

    let fullResponse = '';
    let functionCall: any = null;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        fullResponse += delta.content;
        if (onToken) {
          onToken(delta.content);
        }
      }

      if (delta?.function_call) {
        if (!functionCall) {
          functionCall = { name: '', arguments: '' };
        }
        if (delta.function_call.name) {
          functionCall.name = delta.function_call.name;
        }
        if (delta.function_call.arguments) {
          functionCall.arguments += delta.function_call.arguments;
        }
      }
    }

    // Handle function call if present
    if (functionCall && functionCall.name) {
      const functionArgs = JSON.parse(functionCall.arguments);
      const functionResult = await executeFunction(functionCall.name, functionArgs, userId);

      // Get natural language response for the function result
      const followUpResponse = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          ...messages,
          {
            role: 'assistant',
            content: fullResponse || null,
            function_call: functionCall,
          },
          {
            role: 'function',
            name: functionCall.name,
            content: JSON.stringify(functionResult),
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const finalResponse = followUpResponse.choices[0].message.content || 'No response';
      if (onComplete) onComplete(finalResponse);

      return {
        response: finalResponse,
        functionCalls: [{ name: functionCall.name, arguments: functionArgs, result: functionResult }],
      };
    }

    if (onComplete) onComplete(fullResponse);
    return { response: fullResponse };
  } catch (error: any) {
    logger.error('Streaming AI error:', error);
    const errorMsg = 'An error occurred while processing your request.';
    if (onToken) onToken(errorMsg);
    if (onComplete) onComplete(errorMsg);
    return { response: errorMsg };
  }
}

export { isConfigured as isOpenAIConfigured };
