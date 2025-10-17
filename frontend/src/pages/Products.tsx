import { useEffect, useState } from 'react';
import { Search, Plus, Edit, Trash2, AlertTriangle, TrendingUp } from 'lucide-react';
import api from '../services/api';
import { Product } from '../types';
import toast from 'react-hot-toast';
import ForecastModal from '../components/analytics/ForecastModal';

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [forecastModal, setForecastModal] = useState<{ productId: string; productName: string } | null>(null);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await api.getProducts({ search, category: selectedCategory });
      setProducts(response.data.products || []);
    } catch (error) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await api.getProductCategories();
      setCategories(response.data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const handleSearch = () => {
    loadProducts();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      await api.deleteProduct(id);
      toast.success('Product deleted successfully');
      loadProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete product');
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Products
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your inventory products
          </p>
        </div>
        <button className="btn btn-primary flex items-center gap-2">
          <Plus size={20} />
          Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search products..."
                className="input pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>
          <select
            className="input md:w-48"
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setTimeout(loadProducts, 100);
            }}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={handleSearch}>
            Search
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Reorder Level</th>
                <th>Unit Price</th>
                <th>GST Rate</th>
                <th>Supplier</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    No products found
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="border-t dark:border-gray-700">
                    <td className="font-medium">{product.name}</td>
                    <td>
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                        {product.category || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          product.currentStock <= product.reorderLevel
                            ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                            : 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                        }`}
                      >
                        {product.currentStock}
                        {product.currentStock <= product.reorderLevel && (
                          <AlertTriangle className="inline ml-1" size={12} />
                        )}
                      </span>
                    </td>
                    <td>{product.reorderLevel}</td>
                    <td>₹{product.unitPrice.toLocaleString('en-IN')}</td>
                    <td>{product.gstRate}%</td>
                    <td>{product.supplier?.name || 'N/A'}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded text-indigo-600"
                          title="View Forecast"
                          onClick={() =>
                            setForecastModal({
                              productId: product.id,
                              productName: product.name,
                            })
                          }
                        >
                          <TrendingUp size={16} />
                        </button>
                        <button
                          className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded text-blue-600"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-600"
                          title="Delete"
                          onClick={() => handleDelete(product.id, product.name)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Forecast Modal */}
      {forecastModal && (
        <ForecastModal
          productId={forecastModal.productId}
          productName={forecastModal.productName}
          onClose={() => setForecastModal(null)}
        />
      )}
    </div>
  );
}
