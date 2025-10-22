import { useEffect, useState } from 'react';
import { Package, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import api from '../services/api';
import { Product } from '../types';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockCount: 0,
    totalValue: 0,
    supplierCount: 0,
  });
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [productsRes, lowStockRes, suppliersRes] = await Promise.all([
        api.getProducts({ limit: 1000 }),
        api.getLowStockProducts(),
        api.getSuppliers(),
      ]);

      const products = productsRes.data.products || [];
      const totalValue = products.reduce(
        (sum: number, p: Product) => sum + p.currentStock * p.unitPrice,
        0
      );

      setStats({
        totalProducts: products.length,
        lowStockCount: lowStockRes.data?.length || 0,
        totalValue,
        supplierCount: suppliersRes.data?.length || 0,
      });

      setLowStockProducts(lowStockRes.data?.slice(0, 5) || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Overview of your inventory
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total Products
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.totalProducts}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Package className="text-blue-600 dark:text-blue-400" size={24} />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Low Stock Items
              </p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">
                {stats.lowStockCount}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <AlertTriangle className="text-red-600 dark:text-red-400" size={24} />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total Value
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                ₹{stats.totalValue.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <TrendingUp className="text-green-600 dark:text-green-400" size={24} />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Suppliers
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.supplierCount}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <Users className="text-purple-600 dark:text-purple-400" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="text-red-600" size={24} />
              Low Stock Alerts
            </h2>
            <Link
              to="/products?filter=lowStock"
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Current Stock</th>
                  <th>Reorder Level</th>
                  <th>Supplier</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.map((product) => (
                  <tr key={product.id} className="border-t dark:border-gray-700">
                    <td className="font-medium">{product.name}</td>
                    <td>
                      <span className="px-2 py-1 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400 rounded text-xs font-medium">
                        {product.currentStock}
                      </span>
                    </td>
                    <td>{product.reorderLevel}</td>
                    <td>{product.supplier?.name || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/products" className="card p-6 hover:shadow-md transition-shadow cursor-pointer">
          <Package className="text-primary-600 mb-3" size={32} />
          <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">
            Add Product
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Add a new product to inventory
          </p>
        </Link>

        <Link to="/chat" className="card p-6 hover:shadow-md transition-shadow cursor-pointer">
          <Package className="text-purple-600 mb-3" size={32} />
          <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">
            AI Assistant
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Chat with AI for inventory insights
          </p>
        </Link>

        <Link to="/invoices" className="card p-6 hover:shadow-md transition-shadow cursor-pointer">
          <Package className="text-green-600 mb-3" size={32} />
          <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">
            Upload Invoice
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Process purchase bills with AI
          </p>
        </Link>
      </div>
    </div>
  );
}
