'use client';

import { useState, useEffect, useCallback } from 'react';
import ContractList from './features/contract/ContractList';
import ContractBase from './features/contract/ContractBase';

interface TimeSeriesDataPoint {
  period: string; // YYYY-MM format
  volume: number; // MWh
  date?: Date;
}

interface Contract {
  _id?: string;
  id?: number;
  name: string;
  type: 'retail' | 'wholesale' | 'offtake';
  category: string;
  state: string;
  counterparty: string;
  startDate: string;
  endDate: string;
  annualVolume: number;
  strikePrice: number;
  unit: string;
  volumeShape: 'flat' | 'solar' | 'wind' | 'custom';
  status: 'active' | 'pending';
  indexation: string;
  referenceDate: string;
  pricingType?: 'fixed' | 'timeseries' | 'custom_time_of_day'; // "escalation" was removed
  escalationRate?: number;
  priceTimeSeries?: number[];
  priceInterval?: 'monthly' | 'quarterly' | 'yearly';
  productDetail?: 'CY' | 'FY' | 'Q1' | 'Q2' | 'Q3' | 'Q4';
  
  // Enhanced volume fields
  timeSeriesData?: TimeSeriesDataPoint[];
  tenor?: {
    value: number;
    unit: 'months' | 'years';
  };
  dataSource?: 'manual' | 'csv_import' | 'api_import';
  yearsCovered?: number[];
  totalVolume?: number;
  
  // Time-based pricing
  timeBasedPricing?: {
    periods: Array<{
      id: string;
      name: string;
      price: number;
      startTime: string;
      endTime: string;
      daysOfWeek: boolean[];
    }>;
    defaultPrice: number;
  };
}


interface SettingsData {
  contractTypes: {
    retail: string[];
    wholesale: string[];
    offtake: string[];
  };
  volumeShapes: { [key: string]: number[] };
  states: string[];
  indexationTypes: string[];
  unitTypes: string[];
}

interface PriceCurve {
  name: string;
  type: 'forward' | 'historical';
  data: Array<{ date: string; price: number }>;
}

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

export default function ContractInputTab() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [filteredContracts, setFilteredContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Omit<Contract, '_id'>>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({
    type: '',
    state: '',
    status: ''
  });

  const [settings, setSettings] = useState<SettingsData>({
    contractTypes: {
      retail: ['Commercial', 'Industrial', 'SME'],
      wholesale: ['PPA', 'ISDA', 'EFET'],
      offtake: ['Corporate PPA', 'Utility PPA']
    },
    volumeShapes: {
      flat: [], // Will be dynamically generated
      solar: [0.1, 0.2, 0.5, 0.8, 1, 1.2, 1.2, 1, 0.8, 0.5, 0.2, 0.1],
      wind: [0.8, 0.9, 1, 1.1, 1, 0.9, 0.8, 0.7, 0.8, 0.9, 1, 0.9],
      custom: []
    },
    states: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS'],
    indexationTypes: ['None', 'CPI', 'WPI', 'Custom'],
    unitTypes: ['Energy', 'Capacity', 'Renewable Energy Certificate'],
  });

  const [priceCurves, setPriceCurves] = useState<PriceCurve[]>([]);

  // Fetch contracts from API
  const fetchContracts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/contracts');
      if (!response.ok) {
        throw new Error('Failed to fetch contracts');
      }
      const data = await response.json();
      setContracts(data);
      setFilteredContracts(data); // Initially, all contracts are shown
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  // Apply filters when contracts or filter criteria change
  useEffect(() => {
    let result = contracts;

    // Search term filter
    if (searchTerm) {
      result = result.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.counterparty.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Dropdown filters
    if (activeFilters.type) {
      result = result.filter(c => c.type === activeFilters.type);
    }
    if (activeFilters.state) {
      result = result.filter(c => c.state === activeFilters.state);
    }
    if (activeFilters.status) {
      result = result.filter(c => c.status === activeFilters.status);
    }

    setFilteredContracts(result);
  }, [searchTerm, activeFilters, contracts]);

  const handleInputChange = (field: keyof Omit<Contract, '_id'>, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error for the field when user starts typing
    if (errors[field]) {
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

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    const method = isEditing ? 'PUT' : 'POST';
    const url = '/api/contracts';
    const body = isEditing ? JSON.stringify({ ...formData, id: (formData as Contract)._id }) : JSON.stringify(formData);
    
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save contract');
      }

      await fetchContracts(); // Refresh list
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
    setFormData(contract); // The full contract object including _id
    setErrors({});
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this contract?')) {
      try {
        const response = await fetch(`/api/contracts?id=${id}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          throw new Error('Failed to delete contract');
        }
        await fetchContracts(); // Refresh list
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
            {isLoading ? (
              <div className="text-center py-10">
                <p>Loading contracts...</p>
              </div>
            ) : error ? (
              <div className="text-center py-10 text-red-600">
                <p>Error: {error}</p>
              </div>
            ) : (
              <ContractList
                contracts={filteredContracts}
                onEdit={handleEdit}
                onDelete={handleDelete}
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
