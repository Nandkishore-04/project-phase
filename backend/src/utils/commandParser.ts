import prisma from '../config/database';

interface CommandResult {
  command: string | null;
  response: string;
  data?: any;
  inventoryUpdates?: any;
}

// Regex patterns for commands
const patterns = {
  // Product queries
  searchProduct: /(?:search|find|show|get)\s+(?:product|item)s?\s+(?:named?|called)?\s*["']?([^"'\n]+)["']?/i,
  lowStock: /(?:show|list|get|find)\s+(?:all\s+)?(?:low\s+stock|out\s+of\s+stock|items\s+below|products\s+below)/i,
  productsByCategory: /(?:show|list|get|find)\s+(?:all\s+)?(?:products?|items?)\s+(?:in|from|of)\s+(?:category\s+)?["']?([^"'\n]+)["']?/i,

  // Stock queries
  checkStock: /(?:what is|show|check|get)\s+(?:the\s+)?(?:stock|quantity)\s+(?:of|for)\s+["']?([^"'\n]+)["']?/i,
  totalInventoryValue: /(?:what is|show|get|calculate)\s+(?:the\s+)?(?:total\s+)?(?:inventory\s+)?value/i,

  // Supplier queries
  searchSupplier: /(?:search|find|show|get)\s+supplier\s+["']?([^"'\n]+)["']?/i,
  listSuppliers: /(?:show|list|get)\s+(?:all\s+)?suppliers?/i,

  // Purchase order (simple, will be expanded in Phase 3)
  createPO: /(?:create|make|generate)\s+(?:a\s+)?(?:purchase\s+order|po)\s+(?:for|with)\s+["']?([^"'\n]+)["']?/i,

  // Help
  help: /^(?:help|what can you do|commands?|\/help)$/i,
};

export const parseCommand = async (input: string, userId: string): Promise<CommandResult> => {
  const trimmedInput = input.trim();

  try {
    // Help command
    if (patterns.help.test(trimmedInput)) {
      return {
        command: 'help',
        response: `I can help you with:

📦 **Product Commands:**
- "Search product [name]" - Find products by name
- "Show low stock" - Display products with low inventory
- "Show products in [category]" - Filter by category
- "Check stock of [product name]" - Get stock level

💰 **Inventory Commands:**
- "Show total inventory value" - Calculate total stock value

🏢 **Supplier Commands:**
- "Search supplier [name]" - Find suppliers
- "Show all suppliers" - List all suppliers

📝 **Purchase Orders:**
- "Create purchase order for [supplier]" - Start a new PO (coming soon with AI)

Type your question naturally, and I'll do my best to help!`,
      };
    }

    // Search product
    const searchProductMatch = patterns.searchProduct.exec(trimmedInput);
    if (searchProductMatch) {
      const searchTerm = searchProductMatch[1];
      const products = await prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm } },
            { description: { contains: searchTerm } },
            { hsnCode: { contains: searchTerm } },
          ],
        },
        include: {
          supplier: true,
        },
        take: 10,
      });

      if (products.length === 0) {
        return {
          command: 'search_product',
          response: `No products found matching "${searchTerm}". Try a different search term.`,
          data: { searchTerm, count: 0 },
        };
      }

      const productList = products
        .map(
          (p, idx) =>
            `${idx + 1}. **${p.name}** - Stock: ${p.currentStock} units, Price: ₹${p.unitPrice}\n   Supplier: ${p.supplier?.name || 'N/A'}`
        )
        .join('\n');

      return {
        command: 'search_product',
        response: `Found ${products.length} product(s) matching "${searchTerm}":\n\n${productList}`,
        data: { searchTerm, count: products.length, products },
      };
    }

    // Low stock
    if (patterns.lowStock.test(trimmedInput)) {
      const lowStockProducts = await prisma.product.findMany({
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
        take: 20,
      });

      if (lowStockProducts.length === 0) {
        return {
          command: 'low_stock',
          response: 'Great news! All products have sufficient stock levels. 🎉',
          data: { count: 0 },
        };
      }

      const productList = lowStockProducts
        .map(
          (p, idx) =>
            `${idx + 1}. **${p.name}** - Current: ${p.currentStock}, Reorder: ${p.reorderLevel}\n   Supplier: ${p.supplier?.name || 'N/A'} | Price: ₹${p.unitPrice}`
        )
        .join('\n');

      return {
        command: 'low_stock',
        response: `⚠️ Found ${lowStockProducts.length} product(s) with low stock:\n\n${productList}\n\nConsider placing purchase orders for these items.`,
        data: { count: lowStockProducts.length, products: lowStockProducts },
      };
    }

    // Products by category
    const categoryMatch = patterns.productsByCategory.exec(trimmedInput);
    if (categoryMatch) {
      const category = categoryMatch[1];
      const products = await prisma.product.findMany({
        where: {
          category: {
            contains: category,
          },
        },
        include: {
          supplier: true,
        },
        take: 20,
      });

      if (products.length === 0) {
        return {
          command: 'products_by_category',
          response: `No products found in category "${category}".`,
          data: { category, count: 0 },
        };
      }

      const productList = products
        .map(
          (p, idx) =>
            `${idx + 1}. **${p.name}** - Stock: ${p.currentStock}, Price: ₹${p.unitPrice}`
        )
        .join('\n');

      return {
        command: 'products_by_category',
        response: `Found ${products.length} product(s) in "${category}":\n\n${productList}`,
        data: { category, count: products.length, products },
      };
    }

    // Check stock
    const stockMatch = patterns.checkStock.exec(trimmedInput);
    if (stockMatch) {
      const productName = stockMatch[1];
      const product = await prisma.product.findFirst({
        where: {
          name: { contains: productName },
        },
        include: {
          supplier: true,
        },
      });

      if (!product) {
        return {
          command: 'check_stock',
          response: `Product "${productName}" not found. Please check the name and try again.`,
          data: { productName },
        };
      }

      const stockStatus =
        product.currentStock <= product.reorderLevel
          ? '⚠️ LOW STOCK'
          : product.currentStock === 0
          ? '❌ OUT OF STOCK'
          : '✅ IN STOCK';

      return {
        command: 'check_stock',
        response: `**${product.name}** ${stockStatus}\n\nCurrent Stock: ${product.currentStock} units\nReorder Level: ${product.reorderLevel} units\nUnit Price: ₹${product.unitPrice}\nSupplier: ${product.supplier?.name || 'N/A'}\nCategory: ${product.category || 'N/A'}`,
        data: { product },
      };
    }

    // Total inventory value
    if (patterns.totalInventoryValue.test(trimmedInput)) {
      const products = await prisma.product.findMany({
        select: {
          currentStock: true,
          unitPrice: true,
          name: true,
        },
      });

      const totalValue = products.reduce(
        (sum, p) => sum + p.currentStock * p.unitPrice,
        0
      );
      const totalItems = products.reduce((sum, p) => sum + p.currentStock, 0);

      return {
        command: 'total_inventory_value',
        response: `📊 **Inventory Summary:**\n\nTotal Products: ${products.length}\nTotal Items in Stock: ${totalItems}\nTotal Inventory Value: ₹${totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        data: { totalValue, totalItems, productCount: products.length },
      };
    }

    // Search supplier
    const supplierMatch = patterns.searchSupplier.exec(trimmedInput);
    if (supplierMatch) {
      const supplierName = supplierMatch[1];
      const suppliers = await prisma.supplier.findMany({
        where: {
          name: { contains: supplierName },
        },
        include: {
          products: {
            select: {
              id: true,
            },
          },
        },
        take: 10,
      });

      if (suppliers.length === 0) {
        return {
          command: 'search_supplier',
          response: `No suppliers found matching "${supplierName}".`,
          data: { supplierName, count: 0 },
        };
      }

      const supplierList = suppliers
        .map(
          (s, idx) =>
            `${idx + 1}. **${s.name}**\n   Products: ${s.products.length} | Rating: ${s.rating || 'N/A'} ⭐\n   Contact: ${s.email || s.phone || 'N/A'}\n   GSTIN: ${s.gstin || 'N/A'}`
        )
        .join('\n');

      return {
        command: 'search_supplier',
        response: `Found ${suppliers.length} supplier(s) matching "${supplierName}":\n\n${supplierList}`,
        data: { supplierName, count: suppliers.length, suppliers },
      };
    }

    // List all suppliers
    if (patterns.listSuppliers.test(trimmedInput)) {
      const suppliers = await prisma.supplier.findMany({
        where: {
          activeStatus: 1,
        },
        include: {
          products: {
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
        take: 20,
      });

      if (suppliers.length === 0) {
        return {
          command: 'list_suppliers',
          response: 'No active suppliers found in the system.',
          data: { count: 0 },
        };
      }

      const supplierList = suppliers
        .map(
          (s, idx) =>
            `${idx + 1}. **${s.name}** (${s.products.length} products) - ${s.city || 'N/A'}, ${s.state || 'N/A'}`
        )
        .join('\n');

      return {
        command: 'list_suppliers',
        response: `Active Suppliers (${suppliers.length}):\n\n${supplierList}`,
        data: { count: suppliers.length, suppliers },
      };
    }

    // Create PO (simple version, will be enhanced in Phase 3)
    const poMatch = patterns.createPO.exec(trimmedInput);
    if (poMatch) {
      const supplierName = poMatch[1];
      return {
        command: 'create_po',
        response: `Creating a purchase order requires advanced AI capabilities. This feature will be available in Phase 3 with GPT-4 integration.\n\nFor now, please use the Purchase Orders page in the application to create orders manually.`,
        data: { supplierName },
      };
    }

    // No command matched - generic response
    return {
      command: null,
      response: `I understand you want to: "${trimmedInput}"\n\nI'm still learning! For now, try one of these:\n- "help" - See all available commands\n- "show low stock" - Check inventory levels\n- "search product [name]" - Find products\n- "list suppliers" - View all suppliers\n\nMore natural language understanding will be available in Phase 3 with AI integration! 🤖`,
    };
  } catch (error) {
    console.error('Error parsing command:', error);
    return {
      command: 'error',
      response: 'Sorry, I encountered an error processing your request. Please try again.',
    };
  }
};
