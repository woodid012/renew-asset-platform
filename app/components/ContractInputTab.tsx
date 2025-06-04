'use client';

import { useState } from 'react';

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
};

const defaultCategories = {
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
};

export default function ContractInputTab({
  contracts,
  selectedContract,
  setSelectedContract,
  addContract,
  updateContract,
  deleteContract,
  volumeShapes,
  settings,
}: ContractInputTabProps) {
  const [formData, setFormData] = useState<Omit<Contract, '_id'> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);

  const states = settings?.states || ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
  const contractTypes = [
    { value: 'retail', label: 'Retail' },
    { value: 'wholesale', label: 'Wholesale' },
    { value: 'offtake', label: 'Offtake' }
  ];
  const volumeShapeOptions = Object.keys(volumeShapes).map(shape => ({
    value: shape,
    label: shape.charAt(0).toUpperCase() + shape.slice(1)
  }));
  const statuses = [
    { value: 'active', label: 'Active' },
    { value: 'pending', label: 'Pending' }
  ];
  const indexationTypes = settings?.indexationTypes || [
    'Fixed',
    'CPI',
    'CPI + 1%',
    'CPI + 0.5%',
    'CPI + 2%',
    'Escalation 2%',
    'Escalation 3%'
  ];
  const unitTypes = (settings?.unitTypes || ['Energy', 'Green']).map(unit => ({
    value: unit,
    label: unit
  }));

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Get categories based on contract type
  const getAvailableCategories = (contractType: string) => {
    if (settings?.contractTypes) {
      return settings.contractTypes[contractType as keyof typeof settings.contractTypes] || [];
    }
    return defaultCategories[contractType as keyof typeof defaultCategories] || [];
  };

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof Omit<Contract, '_id'>, value: any) => {
    if (!formData) return;
    
    setFormData(prev => prev ? { ...prev, [field]: value } : null);
    if (errors[field as string]) { // Cast field to string for Record<string, string> index
      setErrors(prev => ({ ...prev, [field as string]: '' }));
    }
  };

  const handleAddNew = () => {
    setFormData(defaultContract);
    setIsEditing(false);
    setSelectedContract(null);
    setErrors({});
    setShowForm(true);
  };

  const handleEditContract = (contract: Contract) => {
    const { _id, ...contractData } = contract;
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
      if (isEditing && selectedContract) {
        await updateContract({ ...formData, _id: selectedContract._id, id: selectedContract.id });
      } else {
        await addContract(formData);
      }
      handleCancelEdit();
    } catch (error) {
      console.error('Error saving contract:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteContract = async (contract: Contract) => {
    if (!contract._id && !contract.id) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete "${contract.name}"?`);
    if (!confirmed) return;

    try {
      await deleteContract(contract._id || contract.id!.toString());
      if (selectedContract && (selectedContract._id === contract._id || selectedContract.id === contract.id)) {
        setSelectedContract(null);
      }
      if (isEditing && selectedContract && (selectedContract._id === contract._id || selectedContract.id === contract.id)) {
        handleCancelEdit();
      }
    } catch (error) {
      console.error('Error deleting contract:', error);
    }
  };

  const handleCancelEdit = () => {
    setFormData(null);
    setIsEditing(false);
    setSelectedContract(null);
    setErrors({});
    setShowForm(false);
  };

  const handleRowClick = (contract: Contract) => {
    setSelectedContract(contract);
  };

  const getContractTypeColor = (type: string) => {
    switch (type) {
      case 'retail': return 'bg-orange-100 text-orange-800';
      case 'wholesale': return 'bg-green-100 text-green-800';
      case 'offtake': return 'bg-purple-100 text-purple-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'active'
      ? 'bg-green-100 text-green-800'
      : 'bg-yellow-100 text-yellow-800';
  };

  return (
    <div className="space-y-8">
      {/* Contracts Table */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            📋 Contract Portfolio
          </h2>
          <button
            onClick={handleAddNew}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center gap-2"
          >
            ➕ Add New Contract
          </button>
        </div>
        
        {contracts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="mb-4">
              <div className="text-6xl mb-4">📄</div>
              <p className="text-lg">No contracts found</p>
              <p className="text-sm">Get started by adding your first contract</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left p-4 font-semibold text-gray-700">Name</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Type</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Category</th>
                  <th className="text-left p-4 font-semibold text-gray-700">State</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Counterparty</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Annual Volume</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Strike Price</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Period</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract, index) => (
                  <tr
                    key={contract._id || contract.id || index}
                    onClick={() => handleRowClick(contract)}
                    className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedContract && (selectedContract._id === contract._id || selectedContract.id === contract.id)
                        ? 'bg-blue-50 border-l-4 border-l-blue-500'
                        : ''
                    }`}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${contract.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        <span className="font-medium text-gray-900">{contract.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${getContractTypeColor(contract.type)}`}>
                        {contract.type}
                      </span>
                    </td>
                    <td className="p-4 text-gray-700">{contract.category}</td>
                    <td className="p-4 text-gray-700">{contract.state}</td>
                    <td className="p-4 text-gray-700">{contract.counterparty}</td>
                    <td className="p-4 text-gray-700">{contract.annualVolume.toLocaleString()} MWh</td>
                    <td className="p-4 text-gray-700">${contract.strikePrice}/MWh</td>
                    <td className="p-4 text-xs">
                      <div>{contract.startDate}</div>
                      <div>to {contract.endDate}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(contract.status)}`}>
                        {contract.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditContract(contract);
                          }}
                          className="bg-blue-500 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-600 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteContract(contract);
                          }}
                          className="bg-red-500 text-white px-3 py-1 rounded text-xs font-medium hover:bg-red-600 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Contract Form Modal */}
      {showForm && formData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                  {isEditing ? '✏️ Edit Contract' : '➕ Add New Contract'}
                </h2>
                <button
                  onClick={handleCancelEdit}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Contract Form */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Contract Details</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Contract Name */}
                    <div className="md:col-span-2">
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                        Contract Name *
                      </label>
                      <input
                        id="name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className={`w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.name ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                        }`}
                        placeholder="Enter contract name"
                      />
                      {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                    </div>

                    {/* Contract Type */}
                    <div>
                      <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
                        Contract Type *
                      </label>
                      <select
                        id="type"
                        value={formData.type}
                        onChange={(e) => {
                          handleInputChange('type', e.target.value as Contract['type']);
                          // Reset category when type changes
                          handleInputChange('category', '');
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400"
                      >
                        {contractTypes.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Category */}
                    <div>
                      <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                        Category *
                      </label>
                      <select
                        id="category"
                        value={formData.category}
                        onChange={(e) => handleInputChange('category', e.target.value)}
                        className={`w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.category ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <option value="">Select category...</option>
                        {getAvailableCategories(formData.type).map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                      {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
                    </div>

                    {/* State */}
                    <div>
                      <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
                        State *
                      </label>
                      <select
                        id="state"
                        value={formData.state}
                        onChange={(e) => handleInputChange('state', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400"
                      >
                        {states.map(state => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                    </div>

                    {/* Counterparty */}
                    <div>
                      <label htmlFor="counterparty" className="block text-sm font-medium text-gray-700 mb-2">
                        Counterparty *
                      </label>
                      <input
                        id="counterparty"
                        type="text"
                        value={formData.counterparty}
                        onChange={(e) => handleInputChange('counterparty', e.target.value)}
                        className={`w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.counterparty ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                        }`}
                        placeholder="Enter counterparty name"
                      />
                      {errors.counterparty && <p className="mt-1 text-sm text-red-600">{errors.counterparty}</p>}
                    </div>

                    {/* Start Date */}
                    <div>
                      <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date *
                      </label>
                      <input
                        id="startDate"
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => handleInputChange('startDate', e.target.value)}
                        className={`w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.startDate ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                        }`}
                      />
                      {errors.startDate && <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>}
                    </div>

                    {/* End Date */}
                    <div>
                      <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
                        End Date *
                      </label>
                      <input
                        id="endDate"
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => handleInputChange('endDate', e.target.value)}
                        className={`w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.endDate ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                        }`}
                      />
                      {errors.endDate && <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>}
                    </div>

                    {/* Annual Volume */}
                    <div>
                      <label htmlFor="annualVolume" className="block text-sm font-medium text-gray-700 mb-2">
                        Annual Volume (MWh) *
                      </label>
                      <input
                        id="annualVolume"
                        type="number"
                        value={formData.annualVolume || ''}
                        onChange={(e) => handleInputChange('annualVolume', parseFloat(e.target.value) || 0)}
                        className={`w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.annualVolume ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                        }`}
                        placeholder="Enter annual volume"
                        min="0"
                        step="1000"
                      />
                      {errors.annualVolume && <p className="mt-1 text-sm text-red-600">{errors.annualVolume}</p>}
                    </div>

                    {/* Strike Price */}
                    <div>
                      <label htmlFor="strikePrice" className="block text-sm font-medium text-gray-700 mb-2">
                        Strike Price ($/MWh) *
                      </label>
                      <input
                        id="strikePrice"
                        type="number"
                        value={formData.strikePrice || ''}
                        onChange={(e) => handleInputChange('strikePrice', parseFloat(e.target.value) || 0)}
                        className={`w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.strikePrice ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                        }`}
                        placeholder="Enter strike price"
                        min="0"
                        step="0.01"
                      />
                      {errors.strikePrice && <p className="mt-1 text-sm text-red-600">{errors.strikePrice}</p>}
                    </div>

                    {/* Unit */}
                    <div>
                      <label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-2">
                        Unit
                      </label>
                      <select
                        id="unit"
                        value={formData.unit}
                        onChange={(e) => handleInputChange('unit', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400"
                      >
                        {unitTypes.map(unit => (
                          <option key={unit.value} value={unit.value}>{unit.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Volume Shape */}
                    <div>
                      <label htmlFor="volumeShape" className="block text-sm font-medium text-gray-700 mb-2">
                        Volume Shape
                      </label>
                      <select
                        id="volumeShape"
                        value={formData.volumeShape}
                        onChange={(e) => handleInputChange('volumeShape', e.target.value as Contract['volumeShape'])}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400"
                      >
                        {volumeShapeOptions.map(shape => (
                          <option key={shape.value} value={shape.value}>{shape.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Status */}
                    <div>
                      <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                        Status
                      </label>
                      <select
                        id="status"
                        value={formData.status}
                        onChange={(e) => handleInputChange('status', e.target.value as Contract['status'])}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400"
                      >
                        {statuses.map(status => (
                          <option key={status.value} value={status.value}>{status.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Indexation */}
                    <div>
                      <label htmlFor="indexation" className="block text-sm font-medium text-gray-700 mb-2">
                        Indexation
                      </label>
                      <select
                        id="indexation"
                        value={formData.indexation}
                        onChange={(e) => handleInputChange('indexation', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400"
                      >
                        {indexationTypes.map(indexation => (
                          <option key={indexation} value={indexation}>{indexation}</option>
                        ))}
                      </select>
                    </div>

                    {/* Reference Date */}
                    <div>
                      <label htmlFor="referenceDate" className="block text-sm font-medium text-gray-700 mb-2">
                        Reference Date
                      </label>
                      <input
                        id="referenceDate"
                        type="date"
                        value={formData.referenceDate}
                        onChange={(e) => handleInputChange('referenceDate', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Volume Preview */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Volume Preview</h3>
                  
                  {formData.annualVolume > 0 ? (
                    <div className="space-y-6">
                      {/* Summary */}
                      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 font-medium">Annual Volume:</span>
                          <span className="text-gray-900 font-semibold">{formData.annualVolume.toLocaleString()} MWh</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 font-medium">Volume Shape:</span>
                          <span className="text-gray-900 font-semibold capitalize">{formData.volumeShape}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 font-medium">Unit:</span>
                          <span className="text-gray-900 font-semibold">{formData.unit}</span>
                        </div>
                      </div>
                      
                      {/* Monthly Breakdown */}
                      <div>
                        <h4 className="text-md font-semibold text-gray-800 mb-4">Monthly Volume Distribution</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {months.map((month, index) => {
                            const volumeProfile = volumeShapes[formData.volumeShape] || volumeShapes.flat;
                            const monthlyVolume = formData.annualVolume * volumeProfile[index] / 100;
                            const percentage = volumeProfile[index];
                            
                            return (
                              <div key={month} className="bg-white border border-gray-200 rounded-lg p-3 text-center hover:bg-gray-50 transition-colors">
                                <div className="font-semibold text-gray-800 text-sm">{month}</div>
                                <div className="text-blue-600 font-medium text-sm">{percentage.toFixed(1)}%</div>
                                <div className="text-gray-600 text-xs">{monthlyVolume.toLocaleString()} MWh</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <p>Enter an annual volume to see the monthly distribution preview</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-4 pt-6 border-t border-gray-200 mt-8">
                <button
                  onClick={handleSaveContract}
                  disabled={isSaving}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isSaving ? 'Saving...' : (isEditing ? 'Update Contract' : 'Add Contract')}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}