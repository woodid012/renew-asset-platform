'use client'

import { useState } from 'react';
import { 
  Save, 
  X,
  Plus,
  FileText,
  TrendingUp,
  Calendar,
  DollarSign,
  Settings
} from 'lucide-react';

const AssetForm = ({ 
  showForm,
  editingAsset,
  formData,
  setFormData,
  onSubmit,
  onCancel,
  getDefaultAssetCosts
}) => {
  const [activeTab, setActiveTab] = useState('basic');

  // Safe helper to get string values
  const safeValue = (value) => {
    if (value === null || value === undefined) return '';
    return String(value);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleContractChange = (contractIndex, field, value) => {
    setFormData(prev => ({
      ...prev,
      contracts: prev.contracts.map((contract, index) => 
        index === contractIndex ? { ...contract, [field]: value } : contract
      )
    }));
  };

  const addContract = () => {
    const newContract = {
      id: Date.now().toString(),
      counterparty: '',
      type: formData.type === 'storage' ? 'tolling' : 'bundled',
      buyersPercentage: 100,
      strikePrice: '',
      indexation: 2.5,
      indexationReferenceYear: new Date().getFullYear(),
      startDate: formData.assetStartDate || '',
      endDate: '',
      hasFloor: false,
      floorValue: ''
    };

    setFormData(prev => ({
      ...prev,
      contracts: [...prev.contracts, newContract]
    }));
  };

  const removeContract = (contractIndex) => {
    setFormData(prev => ({
      ...prev,
      contracts: prev.contracts.filter((_, index) => index !== contractIndex)
    }));
  };

  const getContractTypeOptions = (assetType) => {
    if (assetType === 'storage') {
      return ['tolling', 'cfd', 'fixed'];
    }
    return ['bundled', 'green', 'Energy', 'fixed'];
  };

  if (!showForm) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-screen overflow-y-auto">
        <form onSubmit={onSubmit}>
          {/* Form Header */}
          <div className="flex justify-between items-center p-6 border-b">
            <h2 className="text-xl font-semibold">
              {editingAsset ? 'Edit Asset' : 'Add New Asset'}
            </h2>
            <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'basic', label: 'Basic Details', icon: FileText },
                { id: 'performance', label: 'Performance', icon: TrendingUp },
                { id: 'timeline', label: 'Timeline', icon: Calendar },
                { id: 'contracts', label: 'Contracts', icon: DollarSign },
                { id: 'costs', label: 'Costs', icon: Settings }
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-green-500 text-green-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4 inline mr-2" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* Basic Details Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Asset Name</label>
                    <input
                      type="text"
                      value={safeValue(formData.name)}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <select
                      value={formData.state}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      {['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS'].map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Technology Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => handleInputChange('type', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="solar">Solar</option>
                      <option value="wind">Wind</option>
                      <option value="storage">Battery Storage</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Capacity (MW)</label>
                    <input
                      type="number"
                      value={safeValue(formData.capacity)}
                      onChange={(e) => handleInputChange('capacity', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      step="0.1"
                      required
                    />
                  </div>
                  {formData.type === 'storage' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Storage Volume (MWh)</label>
                      <input
                        type="number"
                        value={safeValue(formData.volume)}
                        onChange={(e) => handleInputChange('volume', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        step="0.1"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Asset Life (years)</label>
                    <input
                      type="number"
                      value={formData.assetLife}
                      onChange={(e) => handleInputChange('assetLife', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Performance Tab */}
            {activeTab === 'performance' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Volume Loss Adjustment (%)</label>
                    <input
                      type="number"
                      value={safeValue(formData.volumeLossAdjustment)}
                      onChange={(e) => handleInputChange('volumeLossAdjustment', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Annual Degradation (%)</label>
                    <input
                      type="number"
                      value={safeValue(formData.annualDegradation)}
                      onChange={(e) => handleInputChange('annualDegradation', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      step="0.1"
                    />
                  </div>
                </div>

                {formData.type !== 'storage' && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Quarterly Capacity Factors (%)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {['q1', 'q2', 'q3', 'q4'].map(quarter => (
                        <div key={quarter}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {quarter.toUpperCase()}
                          </label>
                          <input
                            type="number"
                            value={safeValue(formData[`qtrCapacityFactor_${quarter}`])}
                            onChange={(e) => handleInputChange(`qtrCapacityFactor_${quarter}`, e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md"
                            min="0"
                            max="100"
                            step="0.1"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Timeline Tab */}
            {activeTab === 'timeline' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Construction Start</label>
                    <input
                      type="date"
                      value={safeValue(formData.constructionStartDate)}
                      onChange={(e) => handleInputChange('constructionStartDate', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Construction Duration (months)</label>
                    <input
                      type="number"
                      value={safeValue(formData.constructionDuration)}
                      onChange={(e) => handleInputChange('constructionDuration', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Operations Start</label>
                    <input
                      type="date"
                      value={safeValue(formData.assetStartDate)}
                      onChange={(e) => handleInputChange('assetStartDate', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Contracts Tab */}
            {activeTab === 'contracts' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Revenue Contracts</h3>
                  <button
                    type="button"
                    onClick={addContract}
                    className="bg-green-600 text-white px-3 py-1 rounded flex items-center space-x-1 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Contract</span>
                  </button>
                </div>

                {formData.contracts.map((contract, index) => (
                  <div key={contract.id} className="border border-gray-200 rounded-lg p-4 relative">
                    <button
                      type="button"
                      onClick={() => removeContract(index)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-8">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Counterparty</label>
                        <input
                          type="text"
                          value={safeValue(contract.counterparty)}
                          onChange={(e) => handleContractChange(index, 'counterparty', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Contract Type</label>
                        <select
                          value={contract.type}
                          onChange={(e) => handleContractChange(index, 'type', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md"
                        >
                          {getContractTypeOptions(formData.type).map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Strike Price ($/MWh)</label>
                        <input
                          type="number"
                          value={safeValue(contract.strikePrice)}
                          onChange={(e) => handleContractChange(index, 'strikePrice', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Buyer's Percentage (%)</label>
                        <input
                          type="number"
                          value={safeValue(contract.buyersPercentage)}
                          onChange={(e) => handleContractChange(index, 'buyersPercentage', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md"
                          min="0"
                          max="100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <input
                          type="date"
                          value={safeValue(contract.startDate)}
                          onChange={(e) => handleContractChange(index, 'startDate', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <input
                          type="date"
                          value={safeValue(contract.endDate)}
                          onChange={(e) => handleContractChange(index, 'endDate', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Indexation (%/year)</label>
                        <input
                          type="number"
                          value={safeValue(contract.indexation)}
                          onChange={(e) => handleContractChange(index, 'indexation', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md"
                          step="0.1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reference Year</label>
                        <input
                          type="number"
                          value={safeValue(contract.indexationReferenceYear)}
                          onChange={(e) => handleContractChange(index, 'indexationReferenceYear', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md"
                          min="2020"
                          max="2030"
                        />
                      </div>

                      {/* Contract type specific fields */}
                      {contract.type === 'bundled' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Energy Price ($/MWh)</label>
                            <input
                              type="number"
                              value={safeValue(contract.EnergyPrice)}
                              onChange={(e) => handleContractChange(index, 'EnergyPrice', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-md"
                              step="0.01"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Green Price ($/MWh)</label>
                            <input
                              type="number"
                              value={safeValue(contract.greenPrice)}
                              onChange={(e) => handleContractChange(index, 'greenPrice', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-md"
                              step="0.01"
                            />
                          </div>
                        </>
                      )}

                      {/* Floor options */}
                      <div className="col-span-2">
                        <div className="flex items-center space-x-2 mb-2">
                          <input
                            type="checkbox"
                            id={`hasFloor-${index}`}
                            checked={contract.hasFloor || false}
                            onChange={(e) => handleContractChange(index, 'hasFloor', e.target.checked)}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded"
                          />
                          <label htmlFor={`hasFloor-${index}`} className="text-sm font-medium text-gray-700">
                            Has Floor Price
                          </label>
                        </div>
                        {contract.hasFloor && (
                          <input
                            type="number"
                            placeholder="Floor Value"
                            value={safeValue(contract.floorValue)}
                            onChange={(e) => handleContractChange(index, 'floorValue', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md"
                            step="0.01"
                          />
                        )}
                      </div>
                    </div>

                    {/* Contract Summary */}
                    <div className="mt-4 p-3 bg-gray-50 rounded">
                      <div className="text-sm text-gray-600">
                        <strong>Contract Summary:</strong> {contract.counterparty || 'TBD'} • 
                        {contract.type} • {contract.buyersPercentage}% • 
                        ${contract.strikePrice || '0'}/MWh
                        {contract.startDate && contract.endDate && (
                          <span> • {Math.round((new Date(contract.endDate) - new Date(contract.startDate)) / (365.25 * 24 * 60 * 60 * 1000))} years</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {formData.contracts.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>No contracts added yet</p>
                    <p className="text-sm">Add contracts to define revenue arrangements</p>
                  </div>
                )}
              </div>
            )}

            {/* Costs Tab */}
            {activeTab === 'costs' && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Cost Configuration</h4>
                  <p className="text-sm text-blue-700">
                    Asset costs are automatically calculated based on capacity and technology type. 
                    You can adjust these in the Bulk Edit tab after saving the asset.
                  </p>
                </div>

                {formData.capacity && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900">Estimated Costs</h4>
                      {(() => {
                        const defaultCosts = getDefaultAssetCosts(formData.type, parseFloat(formData.capacity) || 0);
                        return (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">CAPEX:</span>
                              <span className="font-medium">${defaultCosts.capex}M</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Annual OPEX:</span>
                              <span className="font-medium">${defaultCosts.operatingCosts}M</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Terminal Value:</span>
                              <span className="font-medium">${defaultCosts.terminalValue}M</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900">Finance Assumptions</h4>
                      {(() => {
                        const defaultCosts = getDefaultAssetCosts(formData.type, parseFloat(formData.capacity) || 0);
                        return (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Max Gearing:</span>
                              <span className="font-medium">{(defaultCosts.maxGearing * 100).toFixed(0)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Target DSCR:</span>
                              <span className="font-medium">{defaultCosts.targetDSCRContract}x</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Interest Rate:</span>
                              <span className="font-medium">{(defaultCosts.interestRate * 100).toFixed(1)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Loan Tenor:</span>
                              <span className="font-medium">{defaultCosts.tenorYears} years</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{editingAsset ? 'Update' : 'Create'} Asset</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssetForm;