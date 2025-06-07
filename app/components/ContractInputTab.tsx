'use client';

import { useState } from 'react';
import ContractList from './features/contract/ContractList';
import ContractBase from './features/contract/ContractBase';

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
  // New fields
  pricingType?: 'fixed' | 'escalation' | 'timeseries' | 'custom_time_of_day';
  escalationRate?: number;
  priceTimeSeries?: number[];
  priceInterval?: 'monthly' | 'quarterly' | 'yearly';
  productDetail?: 'CY' | 'FY' | 'Q1' | 'Q2' | 'Q3' | 'Q4';
  // Custom time-based pricing
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
  // Enhanced volume fields
  timeSeriesData?: Array<{
    period: string;
    volume: number;
  }>;
  tenor?: {
    value: number;
    unit: 'months' | 'years';
  };
  dataSource?: 'manual' | 'csv_import' | 'api_import';
  yearsCovered?: number[];
  totalVolume?: number;
}

interface SettingsData {
  contractTypes: {
    retail: string[];
    wholesale: string[];
    offtake: string[];
  };
  volumeShapes: {
    [key: string]: number[];
  };
  states: string[];
  indexationTypes: string[];
  unitTypes: string[];
}

interface ContractInputTabProps {
  contracts: Contract[];
  selectedContract: Contract | null;
  setSelectedContract: (contract: Contract | null) => void;
  addContract: (contract: Omit<Contract, '_id'>) => Promise<Contract>;
  updateContract: (contract: Contract) => Promise<Contract>;
  deleteContract: (contractId: string) => Promise<void>;
  volumeShapes: { [key: string]: number[] };
  settings?: SettingsData;
}

const defaultContract: Omit<Contract, '_id'> = {
  name: '',
  type: 'offtake',
  category: '',
  state: 'NSW',
  counterparty: '',
  startDate: '',
  endDate: '',
  annualVolume: 0,
  strikePrice: 0,
  unit: 'Energy',
  volumeShape: 'flat',
  status: 'active',
  indexation: 'Fixed',
  referenceDate: '',
  pricingType: 'fixed',
  escalationRate: 0,
  priceTimeSeries: [],
  priceInterval: 'monthly',
  productDetail: 'CY',
  timeBasedPricing: {
    periods: [],
    defaultPrice: 0
  },
  tenor: {
    value: 1,
    unit: 'years'
  },
  dataSource: 'manual'
};

const defaultSettings: SettingsData = {
  contractTypes: {
    retail: [
      'Retail Customer',
      'Industrial Customer',
      'Government Customer',
      'Small Business',
      'Residential'
    ],
    wholesale: [
      'Swap',
      'Cap',
      'Floor',
      'Forward',
      'Option'
    ],
    offtake: [
      'Solar Farm',
      'Wind Farm',
      'Battery Storage',
      'Hydro',
      'Gas Peaker'
    ]
  },
  volumeShapes: {
    flat: [8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33],
    solar: [6.5, 7.2, 8.8, 9.5, 10.2, 8.9, 9.1, 9.8, 8.6, 7.4, 6.8, 7.2],
    wind: [11.2, 10.8, 9.2, 7.8, 6.5, 5.9, 6.2, 7.1, 8.4, 9.6, 10.8, 11.5],
    custom: [5.0, 6.0, 7.5, 9.0, 11.0, 12.5, 13.0, 12.0, 10.5, 8.5, 7.0, 6.0]
  },
  states: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'],
  indexationTypes: [
    'Fixed',
    'CPI',
    'CPI + 1%',
    'CPI + 0.5%',
    'CPI + 2%',
    'Escalation 2%',
    'Escalation 3%'
  ],
  unitTypes: ['Energy', 'Green']
};

export default function ContractInputTab({
  contracts,
  selectedContract,
  setSelectedContract,
  addContract,
  updateContract,
  deleteContract,
  volumeShapes,
  settings = defaultSettings,
}: ContractInputTabProps) {
  const [formData, setFormData] = useState<Omit<Contract, '_id'> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);

  const validateForm = (): boolean => {
    if (!formData) return false;
    
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Contract name is required';
    if (!formData.category.trim()) newErrors.category = 'Category is required';
    if (!formData.counterparty.trim()) newErrors.counterparty = 'Counterparty is required';
    if (!formData.startDate) newErrors.startDate = 'Start date is required';
    if (!formData.endDate) newErrors.endDate = 'End date is required';
    if (formData.annualVolume <= 0) newErrors.annualVolume = 'Annual volume must be greater than 0';
    if (formData.strikePrice <= 0) newErrors.strikePrice = 'Strike price must be greater than 0';
    
    if (formData.startDate && formData.endDate && formData.startDate >= formData.endDate) {
      newErrors.endDate = 'End date must be after start date';
    }

    if (formData.pricingType === 'escalation' && !formData.referenceDate) {
      newErrors.referenceDate = 'Reference date is required for escalation pricing';
    }

    // Validate time-based pricing
    if (formData.pricingType === 'custom_time_of_day') {
      if (!formData.timeBasedPricing || formData.timeBasedPricing.periods.length === 0) {
        newErrors.timeBasedPricing = 'At least one pricing period is required for time-of-day pricing';
      } else {
        // Check for overlapping periods
        const periods = formData.timeBasedPricing.periods;
        for (let i = 0; i < periods.length; i++) {
          for (let j = i + 1; j < periods.length; j++) {
            const period1 = periods[i];
            const period2 = periods[j];
            
            // Check if they share any days
            const sharedDays = period1.daysOfWeek.some((day, index) => day && period2.daysOfWeek[index]);
            
            if (sharedDays) {
              // Check for time overlap
              const start1 = period1.startTime;
              const end1 = period1.endTime;
              const start2 = period2.startTime;
              const end2 = period2.endTime;
              
              if ((start1 <= start2 && start2 < end1) || (start2 <= start1 && start1 < end2)) {
                newErrors.timeBasedPricing = `Time periods "${period1.name}" and "${period2.name}" overlap`;
                break;
              }
            }
          }
          if (newErrors.timeBasedPricing) break;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof Omit<Contract, '_id'>, value: any) => {
    if (!formData) return;
    
    setFormData(prev => prev ? { ...prev, [field]: value } : null);
    if (errors[field as string]) {
      setErrors(prev => ({ ...prev, [field as string]: '' }));
    }
  };

  const handleAddNew = () => {
    setFormData({ 
      ...defaultContract,
      timeBasedPricing: {
        periods: [],
        defaultPrice: 0
      },
      tenor: {
        value: 1,
        unit: 'years'
      }
    });
    setIsEditing(false);
    setSelectedContract(null);
    setErrors({});
    setShowForm(true);
  };

  const handleEditContract = (contract: Contract) => {
    const { _id, ...contractData } = contract;
    
    // Ensure timeBasedPricing is properly initialized
    if (!contractData.timeBasedPricing && contractData.pricingType === 'custom_time_of_day') {
      contractData.timeBasedPricing = {
        periods: [],
        defaultPrice: contractData.strikePrice || 0
      };
    }

    // Ensure tenor is properly initialized
    if (!contractData.tenor) {
      contractData.tenor = {
        value: 1,
        unit: 'years'
      };
    }

    // Ensure pricing type is set
    if (!contractData.pricingType) {
      contractData.pricingType = 'fixed';
    }
    
    setFormData(contractData);
    setIsEditing(true);
    setSelectedContract(contract);
    setErrors({});
    setShowForm(true);
  };

  const handleSaveContract = async () => {
    if (!validateForm() || !formData) return;

    setIsSaving(true);
    try {
      // Clean up formData before saving
      const cleanFormData = { ...formData };
      
      // If not using time-based pricing, remove the field
      if (cleanFormData.pricingType !== 'custom_time_of_day') {
        delete cleanFormData.timeBasedPricing;
      }
      
      // If not using escalation or timeseries, remove related fields
      if (cleanFormData.pricingType !== 'escalation') {
        delete cleanFormData.escalationRate;
      }
      
      if (cleanFormData.pricingType !== 'escalation' && cleanFormData.pricingType !== 'timeseries') {
        delete cleanFormData.priceTimeSeries;
        delete cleanFormData.priceInterval;
      }

      // Ensure data source is set
      if (!cleanFormData.dataSource) {
        cleanFormData.dataSource = 'manual';
      }

      if (isEditing && selectedContract) {
        await updateContract({ ...cleanFormData, _id: selectedContract._id, id: selectedContract.id });
      } else {
        await addContract(cleanFormData);
      }
      handleCancelEdit();
    } catch (error) {
      console.error('Error saving contract:', error);
      alert('Failed to save contract. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setFormData(null);
    setIsEditing(false);
    setSelectedContract(null);
    setErrors({});
    setShowForm(false);
  };

  // Create a wrapper function to handle the contract deletion
  const handleDeleteContract = async (contract: Contract) => {
    const contractId = contract._id || contract.id?.toString();
    
    if (!contractId) {
      console.error('No contract ID found for deletion');
      alert('Cannot delete contract: No ID found');
      return;
    }
    
    try {
      await deleteContract(contractId);
    } catch (error) {
      console.error('Error deleting contract:', error);
      throw error; // Re-throw so ContractList can handle the error display
    }
  };

  return (
    <div className="space-y-8">
      {/* Header with Add Button */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              📝 Contract Management
            </h2>
            <p className="text-gray-600 mt-2">
              Create, edit, and manage your energy contracts with advanced volume and pricing configurations
            </p>
          </div>
          
          <button
            onClick={handleAddNew}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center gap-2"
          >
            ➕ Add New Contract
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">{contracts.length}</div>
            <div className="text-sm text-gray-600">Total Contracts</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">
              {contracts.filter(c => c.status === 'active').length}
            </div>
            <div className="text-sm text-gray-600">Active Contracts</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-orange-600">
              {contracts.filter(c => c.timeSeriesData?.length).length}
            </div>
            <div className="text-sm text-gray-600">With Time Series</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-600">
              {new Set(contracts.map(c => c.state)).size}
            </div>
            <div className="text-sm text-gray-600">States Covered</div>
          </div>
        </div>
      </div>

      {/* Contract List */}
      <ContractList
        contracts={contracts}
        selectedContract={selectedContract}
        onSelectContract={setSelectedContract}
        onEditContract={handleEditContract}
        onDeleteContract={handleDeleteContract}
      />

      {/* Contract Form Modal */}
      {showForm && formData && (
        <ContractBase
          formData={formData}
          isEditing={isEditing}
          errors={errors}
          settings={settings}
          volumeShapes={volumeShapes}
          onInputChange={handleInputChange}
          onSave={handleSaveContract}
          onCancel={handleCancelEdit}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}