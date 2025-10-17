import { useEffect, useState } from 'react';
import { Search, Plus, Edit, Trash2, Mail, Phone } from 'lucide-react';
import api from '../services/api';
import { Supplier } from '../types';
import toast from 'react-hot-toast';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const response = await api.getSuppliers({ search });
      setSuppliers(response.data || []);
    } catch (error) {
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      await api.deleteSupplier(id);
      toast.success('Supplier deleted successfully');
      loadSuppliers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete supplier');
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
            Suppliers
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your suppliers
          </p>
        </div>
        <button className="btn btn-primary flex items-center gap-2">
          <Plus size={20} />
          Add Supplier
        </button>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search suppliers..."
              className="input pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && loadSuppliers()}
            />
          </div>
          <button className="btn btn-primary" onClick={loadSuppliers}>
            Search
          </button>
        </div>
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suppliers.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            No suppliers found
          </div>
        ) : (
          suppliers.map((supplier) => (
            <div key={supplier.id} className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                    {supplier.name}
                  </h3>
                  {supplier.gstin && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      GSTIN: {supplier.gstin}
                    </p>
                  )}
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    supplier.activeStatus
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400'
                  }`}
                >
                  {supplier.activeStatus ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                {supplier.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Mail size={14} />
                    <span>{supplier.email}</span>
                  </div>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Phone size={14} />
                    <span>{supplier.phone}</span>
                  </div>
                )}
                {supplier.city && supplier.state && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {supplier.city}, {supplier.state}
                  </p>
                )}
                {supplier.rating !== undefined && supplier.rating > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-500">★</span>
                    <span className="text-sm font-medium">{supplier.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-4 border-t dark:border-gray-700">
                <button
                  className="flex-1 btn btn-secondary text-sm py-2 flex items-center justify-center gap-2"
                  title="Edit"
                >
                  <Edit size={14} />
                  Edit
                </button>
                <button
                  className="flex-1 btn btn-danger text-sm py-2 flex items-center justify-center gap-2"
                  title="Delete"
                  onClick={() => handleDelete(supplier.id, supplier.name)}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
