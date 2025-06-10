'use client';

import { useState, useEffect } from 'react';
import { Contract, SettingsData } from '@/app/types'; // Using the central types file
import ContractList from './features/contract/ContractList';
import ContractBase from './features/contract/ContractBase';

// 1. Define the props the component will accept from app/page.tsx
interface ContractInputTabProps {
  contracts: Contract[];
  settings: SettingsData;
  addContract: (newContract: Omit<Contract, '_id'>) => Promise<any>;
  updateContract: (updatedContract: Contract) => Promise<any>;
  deleteContract: (contractId: string) => Promise<void>;
}

// An empty contract for the "Add New" form
const initialFormData: Omit<Contract, '_id'> = {
  name: '',
  type: 'retail',
  category: '',
  state: 'NSW',
  counterparty: '',
  startDate: new Date().toISOString().split('T')[0],
  endDate: '',
  annualVolume: 1000,
  strikePrice: 70,
  unit: 'Energy',
  direction: 'sell', // ✅ ADDED: Set default trade direction to 'sell'
  volumeShape: 'flat',
  status: 'active',
  indexation: 'None',
  referenceDate: '',
  pricingType: 'fixed',
  escalationRate: undefined,
  priceTimeSeries: [],
  priceInterval: 'quarterly',
  productDetail: 'CY',
  timeSeriesData: [],
  tenor: { value: 1, unit: 'years' },
  dataSource: 'manual',
  yearsCovered: [],
  totalVolume: 1000,
  timeBasedPricing: {
    periods: [],
    defaultPrice: 70,
  },
};

// 2. Update the component to receive props
export default function ContractInputTab({
  contracts,
  settings,
  addContract,
  updateContract,
  deleteContract,
}: ContractInputTabProps) {
  // 3. Remove state and data fetching that are now handled by the parent
  const [filteredContracts, setFilteredContracts] = useState<Contract[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Omit<Contract, '_id'>>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Search and filter states remain local to this component
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({
    type: '',
    state: '',
    status: ''
  });

  // 4. Use the `contracts` prop from the parent for filtering
  useEffect(() => {
    let result = contracts;

    if (searchTerm) {
      result = result.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.counterparty.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (activeFilters.type) result = result.filter(c => c.type === activeFilters.type);
    if (activeFilters.state) result = result.filter(c => c.state === activeFilters.state);
    if (activeFilters.status) result = result.filter(c => c.status === activeFilters.status);

    setFilteredContracts(result);
  }, [searchTerm, activeFilters, contracts]);

  const handleInputChange = (field: keyof Omit<Contract, '_id'>, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field as keyof typeof errors];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Contract name is required.';
    if (!formData.category) newErrors.category = 'Category is required.';
    if (!formData.counterparty.trim()) newErrors.counterparty = 'Counterparty is required.';
    if (!formData.startDate) newErrors.startDate = 'Start date is required.';
    if (!formData.endDate) newErrors.endDate = 'End date is required.';
    if (formData.endDate && formData.startDate && formData.endDate < formData.startDate) {
      newErrors.endDate = 'End date cannot be before start date.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 5. Update handlers to call functions from props
  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      if (isEditing) {
        // The form data needs to be cast to a full Contract to be updated
        await updateContract(formData as Contract);
      } else {
        await addContract(formData);
      }
      setShowForm(false);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNew = () => {
    setIsEditing(false);
    setFormData(initialFormData);
    setErrors({});
    setShowForm(true);
  };

  const handleEdit = (contract: Contract) => {
    setIsEditing(true);
    setFormData(contract);
    setErrors({});
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this contract?')) {
      try {
        await deleteContract(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setIsEditing(false);
    setErrors({});
  };
  
  // A local state for the selected contract for highlighting in the list
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-gray-50 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Contract Management</h1>
        <p className="text-gray-600 mt-1">
          Add, edit, and manage all your energy contracts from one place.
        </p>
      </header>

      {!showForm && (
        <>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="w-full md:w-1/3">
                <input
                  type="text"
                  placeholder="🔍 Search by name or counterparty..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto">
                <select 
                  value={activeFilters.type}
                  onChange={(e) => setActiveFilters(prev => ({ ...prev, type: e.target.value }))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="retail">Retail</option>
                  <option value="wholesale">Wholesale</option>
                  <option value="offtake">Offtake</option>
                </select>
                <select 
                  value={activeFilters.state}
                  onChange={(e) => setActiveFilters(prev => ({ ...prev, state: e.target.value }))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All States</option>
                  {settings.states.map(state => <option key={state} value={state}>{state}</option>)}
                </select>
                <select 
                  value={activeFilters.status}
                  onChange={(e) => setActiveFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              <button
                onClick={handleAddNew}
                className="w-full md:w-auto bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <span>➕</span> Add New Contract
              </button>
            </div>
          </div>
          
          <div className="mt-6">
            {error ? (
              <div className="text-center py-10 text-red-600">
                <p>Error: {error}</p>
              </div>
            ) : (
              <ContractList
                contracts={filteredContracts}
                selectedContract={selectedContract}
                onSelectContract={setSelectedContract}
                onEditContract={handleEdit}
                onDeleteContract={handleDelete}
              />
            )}
          </div>
        </>
      )}

      {showForm && formData && (
        <ContractBase
          formData={formData}
          isEditing={isEditing}
          errors={errors}
          settings={settings}
          volumeShapes={settings.volumeShapes}
          onInputChange={handleInputChange}
          onSave={handleSave}
          onCancel={handleCancel}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}