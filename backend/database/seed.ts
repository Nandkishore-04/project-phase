import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create users
  const adminPassword = await bcrypt.hash('admin123', 10);
  const managerPassword = await bcrypt.hash('manager123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@inventory.com' },
    update: {},
    create: {
      email: 'admin@inventory.com',
      passwordHash: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@inventory.com' },
    update: {},
    create: {
      email: 'manager@inventory.com',
      passwordHash: managerPassword,
      name: 'Manager User',
      role: 'MANAGER',
    },
  });

  console.log('Created users:', { admin: admin.email, manager: manager.email });

  // Create suppliers
  const suppliers = [
    {
      name: 'TechWorld Supplies',
      gstin: '29ABCDE1234F1Z5',
      email: 'sales@techworld.com',
      phone: '+91-9876543210',
      address: '123 Tech Park',
      city: 'Bangalore',
      state: 'Karnataka',
      stateCode: '29',
      pincode: '560001',
      rating: 4.5,
      activeStatus: 1,
    },
    {
      name: 'Global Electronics',
      gstin: '27FGHIJ5678K2L1',
      email: 'orders@globalelec.com',
      phone: '+91-9988776655',
      address: '456 Electronic City',
      city: 'Mumbai',
      state: 'Maharashtra',
      stateCode: '27',
      pincode: '400001',
      rating: 4.2,
      activeStatus: 1,
    },
    {
      name: 'Smart Solutions Inc',
      gstin: '06MNOPQ9012R3S4',
      email: 'contact@smartsol.com',
      phone: '+91-8877665544',
      address: '789 Industrial Area',
      city: 'Delhi',
      state: 'Delhi',
      stateCode: '07',
      pincode: '110001',
      rating: 4.7,
      activeStatus: 1,
    },
    {
      name: 'Precision Parts Co',
      gstin: '33TUVWX3456Y7Z8',
      email: 'info@precisionparts.com',
      phone: '+91-7766554433',
      address: '321 Manufacturing Hub',
      city: 'Chennai',
      state: 'Tamil Nadu',
      stateCode: '33',
      pincode: '600001',
      rating: 4.0,
      activeStatus: 1,
    },
    {
      name: 'Quality Traders',
      gstin: '24YZABC7890D1E2',
      email: 'sales@qualitytrade.com',
      phone: '+91-6655443322',
      address: '654 Trade Center',
      city: 'Ahmedabad',
      state: 'Gujarat',
      stateCode: '24',
      pincode: '380001',
      rating: 3.8,
      activeStatus: 1,
    },
    {
      name: 'Innovative Systems',
      gstin: '19FGHIJ1234K5L6',
      email: 'support@innovative.com',
      phone: '+91-5544332211',
      address: '987 Tech Valley',
      city: 'Hyderabad',
      state: 'Telangana',
      stateCode: '36',
      pincode: '500001',
      rating: 4.4,
      activeStatus: 1,
    },
    {
      name: 'Reliable Suppliers',
      gstin: '32MNOPQ5678R9S0',
      email: 'contact@reliable.com',
      phone: '+91-4433221100',
      address: '147 Supply Chain Road',
      city: 'Kochi',
      state: 'Kerala',
      stateCode: '32',
      pincode: '682001',
      rating: 4.1,
      activeStatus: 1,
    },
    {
      name: 'Prime Electronics',
      gstin: '09TUVWX9012Y3Z4',
      email: 'orders@primeelec.com',
      phone: '+91-3322110099',
      address: '258 Component Plaza',
      city: 'Pune',
      state: 'Maharashtra',
      stateCode: '27',
      pincode: '411001',
      rating: 4.6,
      activeStatus: 1,
    },
    {
      name: 'Tech Components Ltd',
      gstin: '22ABCDE3456F7G8',
      email: 'sales@techcomp.com',
      phone: '+91-2211009988',
      address: '369 Parts Avenue',
      city: 'Jaipur',
      state: 'Rajasthan',
      stateCode: '08',
      pincode: '302001',
      rating: 3.9,
      activeStatus: 1,
    },
    {
      name: 'Digital Supplies Co',
      gstin: '10HIJKL7890M1N2',
      email: 'info@digitalsup.com',
      phone: '+91-1100998877',
      address: '741 Digital Park',
      city: 'Kolkata',
      state: 'West Bengal',
      stateCode: '19',
      pincode: '700001',
      rating: 4.3,
      activeStatus: 1,
    },
  ];

  const createdSuppliers = await Promise.all(
    suppliers.map((supplier) =>
      prisma.supplier.upsert({
        where: { gstin: supplier.gstin },
        update: {},
        create: supplier,
      })
    )
  );

  console.log(`Created ${createdSuppliers.length} suppliers`);

  // Create products
  const products = [
    { name: 'Laptop Dell Latitude 5420', category: 'Electronics', hsnCode: '84713000', gstRate: 18, stock: 45, reorder: 10, price: 65000 },
    { name: 'Desktop HP EliteDesk 800', category: 'Electronics', hsnCode: '84713000', gstRate: 18, stock: 32, reorder: 8, price: 55000 },
    { name: 'Monitor Samsung 24-inch', category: 'Electronics', hsnCode: '85285200', gstRate: 18, stock: 78, reorder: 15, price: 12000 },
    { name: 'Keyboard Logitech Wireless', category: 'Accessories', hsnCode: '84716060', gstRate: 18, stock: 120, reorder: 30, price: 1500 },
    { name: 'Mouse Logitech M331', category: 'Accessories', hsnCode: '84716070', gstRate: 18, stock: 150, reorder: 40, price: 600 },
    { name: 'Printer Canon Pixma', category: 'Electronics', hsnCode: '84433210', gstRate: 18, stock: 25, reorder: 5, price: 8500 },
    { name: 'Scanner Epson DS-530', category: 'Electronics', hsnCode: '84716020', gstRate: 18, stock: 18, reorder: 5, price: 15000 },
    { name: 'Webcam Logitech C920', category: 'Accessories', hsnCode: '85258010', gstRate: 18, stock: 55, reorder: 15, price: 7500 },
    { name: 'Headset Jabra Evolve', category: 'Accessories', hsnCode: '85183000', gstRate: 18, stock: 90, reorder: 25, price: 9500 },
    { name: 'External HDD 2TB Seagate', category: 'Hardware', hsnCode: '84717050', gstRate: 18, stock: 65, reorder: 15, price: 5500 },
    { name: 'SSD 1TB Samsung 970 EVO', category: 'Hardware', hsnCode: '84717050', gstRate: 18, stock: 42, reorder: 10, price: 11000 },
    { name: 'RAM 16GB DDR4 Corsair', category: 'Components', hsnCode: '84733020', gstRate: 18, stock: 88, reorder: 20, price: 6500 },
    { name: 'Graphics Card RTX 3060', category: 'Components', hsnCode: '84733020', gstRate: 18, stock: 15, reorder: 5, price: 35000 },
    { name: 'Motherboard ASUS Prime', category: 'Components', hsnCode: '84733020', gstRate: 18, stock: 22, reorder: 5, price: 12500 },
    { name: 'Processor Intel i7-12700', category: 'Components', hsnCode: '85423100', gstRate: 18, stock: 28, reorder: 8, price: 32000 },
    { name: 'Power Supply 750W Cooler Master', category: 'Hardware', hsnCode: '85044090', gstRate: 18, stock: 45, reorder: 10, price: 7000 },
    { name: 'Cabinet Corsair 4000D', category: 'Hardware', hsnCode: '84733010', gstRate: 18, stock: 35, reorder: 8, price: 9000 },
    { name: 'UPS 1KVA APC', category: 'Hardware', hsnCode: '85044030', gstRate: 18, stock: 52, reorder: 12, price: 6500 },
    { name: 'Network Switch 24-port', category: 'Hardware', hsnCode: '85176290', gstRate: 18, stock: 18, reorder: 5, price: 15000 },
    { name: 'Router TP-Link AC1750', category: 'Hardware', hsnCode: '85176290', gstRate: 18, stock: 48, reorder: 12, price: 4500 },
    { name: 'Cable CAT6 305m Roll', category: 'Accessories', hsnCode: '85444900', gstRate: 18, stock: 12, reorder: 3, price: 8500 },
    { name: 'HDMI Cable 2m', category: 'Accessories', hsnCode: '85444900', gstRate: 18, stock: 200, reorder: 50, price: 350 },
    { name: 'USB Cable Type-C 1m', category: 'Accessories', hsnCode: '85444900', gstRate: 18, stock: 180, reorder: 50, price: 250 },
    { name: 'Ethernet Cable 3m', category: 'Accessories', hsnCode: '85444900', gstRate: 18, stock: 150, reorder: 40, price: 200 },
    { name: 'Windows 11 Pro License', category: 'Software', hsnCode: '85234920', gstRate: 18, stock: 75, reorder: 20, price: 18000 },
    { name: 'Microsoft Office 2021', category: 'Software', hsnCode: '85234920', gstRate: 18, stock: 60, reorder: 15, price: 25000 },
    { name: 'Antivirus McAfee Total Protection', category: 'Software', hsnCode: '85234920', gstRate: 18, stock: 95, reorder: 25, price: 2500 },
    { name: 'Adobe Creative Cloud Annual', category: 'Software', hsnCode: '85234920', gstRate: 18, stock: 30, reorder: 10, price: 45000 },
    { name: 'Projector Epson EB-X05', category: 'Electronics', hsnCode: '85286200', gstRate: 18, stock: 12, reorder: 3, price: 35000 },
    { name: 'Projector Screen 100-inch', category: 'Accessories', hsnCode: '90058000', gstRate: 18, stock: 15, reorder: 5, price: 8000 },
    { name: 'Laptop Bag Targus 15.6-inch', category: 'Accessories', hsnCode: '42021290', gstRate: 18, stock: 85, reorder: 20, price: 1500 },
    { name: 'Cooling Pad for Laptop', category: 'Accessories', hsnCode: '84145990', gstRate: 18, stock: 68, reorder: 15, price: 1200 },
    { name: 'Docking Station USB-C', category: 'Accessories', hsnCode: '84733020', gstRate: 18, stock: 42, reorder: 10, price: 8500 },
    { name: 'Conference Camera Logitech', category: 'Electronics', hsnCode: '85258010', gstRate: 18, stock: 8, reorder: 2, price: 45000 },
    { name: 'Microphone Blue Yeti', category: 'Electronics', hsnCode: '85181000', gstRate: 18, stock: 25, reorder: 8, price: 12000 },
    { name: 'Smartphone Samsung Galaxy S23', category: 'Electronics', hsnCode: '85171200', gstRate: 18, stock: 35, reorder: 10, price: 75000 },
    { name: 'Tablet iPad 10th Gen', category: 'Electronics', hsnCode: '85171290', gstRate: 18, stock: 22, reorder: 5, price: 45000 },
    { name: 'Smart Watch Apple Watch SE', category: 'Electronics', hsnCode: '85176990', gstRate: 18, stock: 18, reorder: 5, price: 32000 },
    { name: 'Wireless Charger Anker', category: 'Accessories', hsnCode: '85044030', gstRate: 18, stock: 95, reorder: 25, price: 2500 },
    { name: 'Power Bank 20000mAh', category: 'Accessories', hsnCode: '85076000', gstRate: 18, stock: 120, reorder: 30, price: 2000 },
    { name: 'LED Desk Lamp Philips', category: 'Accessories', hsnCode: '94051000', gstRate: 18, stock: 75, reorder: 20, price: 3500 },
    { name: 'Surge Protector 6-outlet', category: 'Accessories', hsnCode: '85363090', gstRate: 18, stock: 110, reorder: 30, price: 1200 },
    { name: 'Cable Management Box', category: 'Accessories', hsnCode: '39269099', gstRate: 18, stock: 85, reorder: 20, price: 600 },
    { name: 'Monitor Stand Adjustable', category: 'Accessories', hsnCode: '94039090', gstRate: 18, stock: 65, reorder: 15, price: 2500 },
    { name: 'Ergonomic Chair Office Star', category: 'Accessories', hsnCode: '94013000', gstRate: 18, stock: 28, reorder: 8, price: 15000 },
    { name: 'Standing Desk Electric', category: 'Accessories', hsnCode: '94036000', gstRate: 18, stock: 12, reorder: 3, price: 28000 },
    { name: 'Whiteboard 4x3 feet', category: 'Accessories', hsnCode: '96100000', gstRate: 18, stock: 20, reorder: 5, price: 3500 },
    { name: 'Document Scanner Portable', category: 'Electronics', hsnCode: '84716020', gstRate: 18, stock: 32, reorder: 8, price: 12000 },
    { name: 'Label Printer Brother', category: 'Electronics', hsnCode: '84433220', gstRate: 18, stock: 15, reorder: 5, price: 9500 },
    { name: 'Barcode Scanner Honeywell', category: 'Electronics', hsnCode: '84716020', gstRate: 18, stock: 38, reorder: 10, price: 7500 },
  ];

  const createdProducts = [];
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const supplier = createdSuppliers[i % createdSuppliers.length];

    const created = await prisma.product.create({
      data: {
        name: product.name,
        category: product.category,
        hsnCode: product.hsnCode,
        gstRate: product.gstRate,
        currentStock: product.stock,
        reorderLevel: product.reorder,
        unitPrice: product.price,
        supplierId: supplier.id,
        description: `High-quality ${product.name.toLowerCase()} from ${supplier.name}`,
      },
    });
    createdProducts.push(created);
  }

  console.log(`Created ${createdProducts.length} products`);

  // Create stock alerts for low stock products
  const lowStockProducts = createdProducts.filter(p => p.currentStock < p.reorderLevel);
  for (const product of lowStockProducts) {
    await prisma.stockAlert.create({
      data: {
        productId: product.id,
        alertType: 'LOW_STOCK',
        threshold: product.reorderLevel,
        isActive: 1,
        lastTriggered: new Date(),
      },
    });
  }

  console.log(`Created ${lowStockProducts.length} stock alerts`);

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
