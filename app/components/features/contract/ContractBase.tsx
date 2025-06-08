'use client';

import { useState, useEffect } from 'react';
import ContractVolumeEditor from './ContractVolumeEditor';
import ContractPriceEditor from './ContractPriceEditor';
import { Contract, SettingsData, TimeSeriesDataPoint, PriceCurve } from '@/app/types';



interface ContractBaseProps {
  formData: Omit<Contract, '_id'> | null;
  isEditing: boolean;
  errors: Record<string, string>;
  settings: SettingsData;
  volumeShapes: { [key: string]: number[] };
  onInputChange: (field: keyof Omit<Contract, '_id'>, value: any) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

// Volume calculation utilities
const VolumeUtils = {
  calculateEndDate: (startDate: string, tenor: { value: number; unit: 'months' | 'years' }): string => {
    const start = new Date(startDate);
    let endDate = new Date(start);

    if (tenor.unit === 'months') {
      // Add months and go to last day of that month
      endDate.setMonth(endDate.getMonth() + tenor.value);
      endDate.setDate(0); // Set to last day of previous month (which is the target month)
    } else {
      // Add years and go to last day of December
      endDate.setFullYear(endDate.getFullYear() + tenor.value);
      endDate.setMonth(11, 31); // December 31st
    }
    
    return endDate.toISOString().split('T')[0];
  },

  calculateTenor: (startDate: string, endDate: string): { value: number; unit: 'months' | 'years' } => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Calculate months difference (inclusive)
    const yearDiff = end.getFullYear() - start.getFullYear();
    const monthDiff = end.getMonth() - start.getMonth();
    const totalMonths = yearDiff * 12 + monthDiff + 1; // +1 to make it inclusive
    
    // If it's exactly divisible by 12 months and at year boundaries, use years
    if (totalMonths % 12 === 0 && 
        start.getMonth() === 0 && start.getDate() === 1 && // Jan 1st start
        end.getMonth() === 11 && end.getDate() === 31) {   // Dec 31st end
      return {
        value: totalMonths / 12,
        unit: 'years'
      };
    }
    
    // Otherwise use months
    return {
      value: Math.max(1, totalMonths),
      unit: 'months'
    };
  }
};

export default function ContractBase({
  formData,
  isEditing,
  errors,
  settings,
  volumeShapes,
  onInputChange,
  onSave,
  onCancel,
  isSaving,
}: ContractBaseProps) {
  const [showVolumeEditor, setShowVolumeEditor] = useState(false);
  const [showPriceEditor, setShowPriceEditor] = useState(false);

  if (!formData) return null;

  // Initialize default start date to current year
  useEffect(() => {
    if (!formData.startDate) {
      const currentYear = new Date().getFullYear();
      const defaultStartDate = `${currentYear}-01-01`;
      onInputChange('startDate', defaultStartDate);
    }
  }, []);

  // Calculate and update tenor whenever dates change
  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      const calculatedTenor = VolumeUtils.calculateTenor(formData.startDate, formData.endDate);
      onInputChange('tenor', calculatedTenor);
    }
  }, [formData.startDate, formData.endDate]);

  // Handle start date changes
  const handleStartDateChange = (startDate: string) => {
    onInputChange('startDate', startDate);
  };

  // Handle end date changes
  const handleEndDateChange = (endDate: string) => {
    onInputChange('endDate', endDate);
  };

  // Get categories based on contract type
  const getAvailableCategories = (contractType: string) => {
    if (settings?.contractTypes) {
      return settings.contractTypes[contractType as keyof typeof settings.contractTypes] || [];
    }
    return [];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-7xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              {isEditing ? '✏️ Edit Contract' : '➕ Add New Contract'}
            </h2>
            <button
              onClick={onCancel}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Main Contract Details Form */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            
            {/* Left Column - Basic Contract Details */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Contract Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Contract Name */}
                <div className="md:col-span-2">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Contract Name *
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => onInputChange('name', e.target.value)}
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
                      onInputChange('type', e.target.value as Contract['type']);
                      onInputChange('category', '');
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400"
                  >
                    <option value="retail">Retail</option>
                    <option value="wholesale">Wholesale</option>
                    <option value="offtake">Offtake</option>
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
                    onChange={(e) => onInputChange('category', e.target.value)}
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
                    onChange={(e) => onInputChange('state', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400"
                  >
                    {settings.states.map(state => (
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
                    onChange={(e) => onInputChange('counterparty', e.target.value)}
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
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.startDate ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  />
                  {errors.startDate && <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>}
                </div>

                {/* Contract Tenor (Calculated) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contract Tenor (Calculated)
                  </label>
                  <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600">
                    {formData.tenor ? `${formData.tenor.value} ${formData.tenor.unit}` : 'Set start and end dates'}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Automatically calculated from start and end dates
                  </p>
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
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.endDate ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  />
                  {errors.endDate && <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>}
                </div>

                {/* Type (was Unit) */}
                <div>
                  <label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-2">
                    Type
                  </label>
                  <select
                    id="unit"
                    value={formData.unit}
                    onChange={(e) => onInputChange('unit', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400"
                  >
                    {settings.unitTypes.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
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
                    onChange={(e) => onInputChange('status', e.target.value as Contract['status'])}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Right Column - Quick Summary */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Contract Summary</h3>
              
              {(formData.annualVolume > 0 || formData.timeSeriesData?.length) && formData.strikePrice > 0 ? (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Contract Period:</span>
                    <span className="text-gray-900 font-semibold">
                      {formData.startDate} to {formData.endDate}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Contract Tenor:</span>
                    <span className="text-gray-900 font-semibold">
                      {formData.tenor?.value} {formData.tenor?.unit}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Strike Price:</span>
                    <span className="text-gray-900 font-semibold">${formData.strikePrice}/MWh</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Annual Volume:</span>
                    <span className="text-gray-900 font-semibold">
                      {formData.annualVolume?.toLocaleString()} MWh
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p>Enter contract details to see the summary</p>
                </div>
              )}
            </div>
          </div>

          {/* Volume and Price Editor Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            
            {/* Volume Configuration */}
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  📊 Volume Configuration
                </h4>
                <button
                  type="button"
                  onClick={() => setShowVolumeEditor(true)}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors"
                >
                  Configure Volume
                </button>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Data Source:</span>
                  <span className="font-medium">
                    {formData.timeSeriesData?.length ? 'Monthly Time Series' : 'Percentage Shape'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Volume:</span>
                  <span className="font-medium">
                    {formData.timeSeriesData?.length 
                      ? `${formData.totalVolume?.toLocaleString() || 0} MWh (${formData.timeSeriesData.length} periods)`
                      : `${formData.annualVolume?.toLocaleString() || 0} MWh (${formData.volumeShape})`
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Price Configuration */}
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  💰 Price Configuration
                </h4>
                <button
                  type="button"
                  onClick={() => setShowPriceEditor(true)}
                  className="bg-green-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-600 transition-colors"
                >
                  Configure Pricing
                </button>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Pricing Type:</span>
                  <span className="font-medium capitalize">
                    {formData.pricingType || 'Fixed'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Base Price:</span>
                  <span className="font-medium">${formData.strikePrice || 0}/MWh</span>
                </div>

                {formData.pricingType === 'timeseries' && formData.priceTimeSeries?.length && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Price Series:</span>
                    <span className="font-medium">{formData.priceTimeSeries.length} periods</span>
                  </div>
                )}
                {formData.pricingType === 'custom_time_of_day' && formData.timeBasedPricing?.periods?.length && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time Periods:</span>
                    <span className="font-medium">{formData.timeBasedPricing.periods.length} periods</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <button
              onClick={onSave}
              disabled={isSaving}
              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isSaving ? 'Saving...' : (isEditing ? 'Update Contract' : 'Add Contract')}
            </button>
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Volume Editor Modal */}
        {showVolumeEditor && (
          <ContractVolumeEditor
            formData={formData}
            volumeShapes={volumeShapes}
            onInputChange={onInputChange}
            onClose={() => setShowVolumeEditor(false)}
          />
        )}

        {/* Price Editor Modal */}
        {showPriceEditor && (
          <ContractPriceEditor
            formData={formData}
            errors={errors}
            settings={settings}
            onInputChange={onInputChange}
            onClose={() => setShowPriceEditor(false)}
          />
        )}
      </div>
    </div>
  );
}