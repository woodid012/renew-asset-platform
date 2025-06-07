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
  pricingType?: 'fixed' | 'timeseries' | 'custom_time_of_day';
  escalationRate?: number;
  priceTimeSeries?: number[];
  priceInterval?: 'monthly' | 'quarterly' | 'yearly';
  
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

interface ContractPriceEditorProps {
  formData: Omit<Contract, '_id'>;
  errors: Record<string, string>;
  settings: SettingsData;
  onInputChange: (field: keyof Omit<Contract, '_id'>, value: any) => void;
  onClose: () => void;
}

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ContractPriceEditor({
  formData,
  errors,
  settings,
  onInputChange,
  onClose,
}: ContractPriceEditorProps) {
  const [priceDataFile, setPriceDataFile] = useState<File | null>(null);
  const [showEscalationPreview, setShowEscalationPreview] = useState(true);
  const [newPeriod, setNewPeriod] = useState({
    id: '',
    name: '',
    price: 0,
    startTime: '09:00',
    endTime: '17:00',
    daysOfWeek: [true, true, true, true, true, false, false] // Mon-Fri default
  });

  // Initialize pricing type if not set
  const currentPricingType = formData.pricingType || 'fixed';

  // CPI Preset configurations
  const getCPIPreset = (presetType: string) => {
    const presets = {
      rba_quarterly: { rate: 2.5 },
      rba_annual: { rate: 2.5 },
      historical_avg: { rate: 2.8 },
      conservative: { rate: 2.0 },
      optimistic: { rate: 3.5 }
    };
    
    return presets[presetType as keyof typeof presets] || presets.rba_annual;
  };

  // Calculate contract duration for time series
  const calculateContractPeriods = (interval: 'monthly' | 'quarterly' | 'yearly') => {
    if (!formData.startDate || !formData.endDate) return 12; // Default fallback
    
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    
    if (interval === 'monthly') {
      // Calculate months inclusive (from Jan 1 to Dec 31 = 12 months)
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
      return Math.max(1, months);
    } else if (interval === 'quarterly') {
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
      return Math.max(1, Math.ceil(months / 3));
    } else {
      // For yearly, if same year then 1 year, otherwise count years inclusive
      const years = end.getFullYear() - start.getFullYear() + 1;
      return Math.max(1, years);
    }
  };

  // Handle pricing type change
  const handlePricingTypeChange = (type: 'fixed' | 'timeseries' | 'custom_time_of_day') => {
    onInputChange('pricingType', type);
    
    // Initialize default values based on type
    if (type === 'timeseries') {
      const defaultInterval = 'quarterly';
      const periods = calculateContractPeriods(defaultInterval);
      onInputChange('priceTimeSeries', Array(periods).fill(formData.strikePrice || 70));
      onInputChange('priceInterval', defaultInterval);
    }
    
    if (type === 'custom_time_of_day' && !formData.timeBasedPricing) {
      onInputChange('timeBasedPricing', {
        periods: [],
        defaultPrice: formData.strikePrice || 70
      });
    }
  };

  // Handle CSV price data upload
  const handlePriceDataUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPriceDataFile(file);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].toLowerCase().split(',');
      
      // Find price column
      const priceIndex = headers.findIndex(h => 
        h.includes('price') || h.includes('rate') || h.includes('$/mwh') || h.includes('value')
      );
      
      if (priceIndex === -1) {
        alert('CSV must have a column for price ($/MWh)');
        return;
      }

      const priceData: number[] = [];
      
      lines.slice(1).forEach(line => {
        const cells = line.split(',');
        const priceStr = cells[priceIndex]?.trim();
        
        if (!priceStr) return;
        
        const price = parseFloat(priceStr);
        if (!isNaN(price)) {
          priceData.push(price);
        }
      });

      if (priceData.length === 0) {
        alert('No valid price data found in CSV');
        return;
      }

      // Update form data
      onInputChange('priceTimeSeries', priceData);
      onInputChange('pricingType', 'timeseries');
      
      // Set interval based on data length
      if (priceData.length <= 4) {
        onInputChange('priceInterval', 'quarterly');
      } else if (priceData.length <= 12) {
        onInputChange('priceInterval', 'monthly');
      } else {
        onInputChange('priceInterval', 'monthly');
      }

    } catch (error) {
      console.error('Error parsing price file:', error);
      alert('Error parsing price file. Please ensure it\'s a valid CSV with price columns.');
    }
  };

  // Update time series price
  const updateTimeSeriesPrice = (index: number, value: number) => {
    if (!formData.priceTimeSeries) return;

    const updatedSeries = [...formData.priceTimeSeries];
    updatedSeries[index] = value;
    onInputChange('priceTimeSeries', updatedSeries);
  };

  // Add time-based pricing period
  const addPricingPeriod = () => {
    if (!newPeriod.name.trim()) {
      alert('Please enter a period name');
      return;
    }

    const period = {
      ...newPeriod,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    };

    const currentPricing = formData.timeBasedPricing || { periods: [], defaultPrice: formData.strikePrice || 0 };
    const updatedPricing = {
      ...currentPricing,
      periods: [...currentPricing.periods, period]
    };

    onInputChange('timeBasedPricing', updatedPricing);
    
    // Reset form
    setNewPeriod({
      id: '',
      name: '',
      price: 0,
      startTime: '09:00',
      endTime: '17:00',
      daysOfWeek: [true, true, true, true, true, false, false]
    });
  };

  // Remove pricing period
  const removePricingPeriod = (periodId: string) => {
    if (!formData.timeBasedPricing) return;

    const updatedPricing = {
      ...formData.timeBasedPricing,
      periods: formData.timeBasedPricing.periods.filter(p => p.id !== periodId)
    };

    onInputChange('timeBasedPricing', updatedPricing);
  };

  // Generate price escalation preview
  const generateEscalationPreview = (): number[] => {
    if (!formData.escalationRate || !formData.strikePrice) return [];

    const basePrice = currentPricingType === 'timeseries' && formData.priceTimeSeries 
      ? formData.priceTimeSeries.reduce((a, b) => a + b, 0) / formData.priceTimeSeries.length
      : formData.strikePrice;
    
    const rate = formData.escalationRate / 100;
    const preview: number[] = [];

    for (let year = 0; year < 5; year++) {
      const escalatedPrice = basePrice * Math.pow(1 + rate, year);
      preview.push(escalatedPrice);
    }

    return preview;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              💰 Price Configuration
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Step 1: Pricing Structure */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Step 1: Choose Pricing Structure</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Fixed Pricing */}
              <div 
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  currentPricingType === 'fixed' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handlePricingTypeChange('fixed')}
              >
                <div className="flex items-center mb-2">
                  <input
                    type="radio"
                    name="pricingType"
                    checked={currentPricingType === 'fixed'}
                    onChange={() => handlePricingTypeChange('fixed')}
                    className="mr-2"
                  />
                  <h4 className="font-semibold text-gray-800">Fixed</h4>
                </div>
                <p className="text-sm text-gray-600">
                  Single fixed price for the entire contract period
                </p>
              </div>

              {/* Time Series Pricing */}
              <div 
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  currentPricingType === 'timeseries' 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handlePricingTypeChange('timeseries')}
              >
                <div className="flex items-center mb-2">
                  <input
                    type="radio"
                    name="pricingType"
                    checked={currentPricingType === 'timeseries'}
                    onChange={() => handlePricingTypeChange('timeseries')}
                    className="mr-2"
                  />
                  <h4 className="font-semibold text-gray-800">Time Series</h4>
                </div>
                <p className="text-sm text-gray-600">
                  Different prices for each period across the contract duration
                </p>
              </div>

              {/* Time-of-Day Pricing */}
              <div 
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  currentPricingType === 'custom_time_of_day' 
                    ? 'border-orange-500 bg-orange-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handlePricingTypeChange('custom_time_of_day')}
              >
                <div className="flex items-center mb-2">
                  <input
                    type="radio"
                    name="pricingType"
                    checked={currentPricingType === 'custom_time_of_day'}
                    onChange={() => handlePricingTypeChange('custom_time_of_day')}
                    className="mr-2"
                  />
                  <h4 className="font-semibold text-gray-800">Time-of-Day</h4>
                </div>
                <p className="text-sm text-gray-600">
                  Different prices for specific time periods and days
                </p>
              </div>
            </div>
          </div>

          {/* Configuration Content Based on Pricing Type */}
          <div className="space-y-6">
            
            {/* Fixed Pricing Configuration */}
            {currentPricingType === 'fixed' && (
              <div className="border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">💰 Fixed Price Configuration</h4>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Strike Price ($/MWh) *
                  </label>
                  <input
                    type="number"
                    value={formData.strikePrice || ''}
                    onChange={(e) => onInputChange('strikePrice', parseFloat(e.target.value) || 0)}
                    className={`w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.strikePrice ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                    placeholder="Enter fixed price"
                    min="0"
                    step="0.01"
                  />
                  {errors.strikePrice && <p className="mt-1 text-sm text-red-600">{errors.strikePrice}</p>}
                </div>

                <div className="bg-blue-50 rounded-lg p-4">
                  <h5 className="font-medium text-blue-800 mb-2">Price Summary</h5>
                  <div className="text-sm text-blue-700">
                    <p>Contract will use a single fixed price of <strong>${formData.strikePrice || 0}/MWh</strong> for the entire duration.</p>
                    <p className="mt-1">This price will remain constant unless escalation is applied in Step 2.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Time Series Pricing Configuration */}
            {currentPricingType === 'timeseries' && (
              <div className="border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">📊 Time Series Configuration</h4>
                
                <div className="space-y-6">
                  {/* Contract Duration Info */}
                  <div className="bg-purple-50 rounded-lg p-4">
                    <h5 className="font-medium text-purple-800 mb-2">Contract Duration</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-purple-600">Start Date:</span>
                        <div className="font-medium">{formData.startDate || 'Not set'}</div>
                      </div>
                      <div>
                        <span className="text-purple-600">End Date:</span>
                        <div className="font-medium">{formData.endDate || 'Not set'}</div>
                      </div>
                      <div>
                        <span className="text-purple-600">Monthly Periods:</span>
                        <div className="font-medium">{calculateContractPeriods('monthly')}</div>
                      </div>
                      <div>
                        <span className="text-purple-600">Quarterly Periods:</span>
                        <div className="font-medium">{calculateContractPeriods('quarterly')}</div>
                      </div>
                    </div>
                  </div>

                  {/* Price Interval Selection */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="block text-sm font-medium text-gray-700">
                        Price Interval
                      </label>
                      <select
                        value={formData.priceInterval || 'quarterly'}
                        onChange={(e) => {
                          const interval = e.target.value as 'monthly' | 'quarterly' | 'yearly';
                          onInputChange('priceInterval', interval);
                          
                          // Create array based on contract duration
                          const periods = calculateContractPeriods(interval);
                          const defaultPrice = formData.strikePrice || 70;
                          onInputChange('priceTimeSeries', Array(periods).fill(defaultPrice));
                        }}
                        className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="quarterly">Quarterly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                  </div>

                  {/* Quick Setup Templates */}
                  <div className="bg-purple-50 rounded-lg p-4">
                    <h5 className="font-medium text-purple-800 mb-3">Quick Setup Templates</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <button
                        onClick={() => {
                          if (formData.priceInterval === 'quarterly') {
                            const periods = calculateContractPeriods('quarterly');
                            const newSeries = Array(periods).fill(65);
                            newSeries[0] = 100; // Q1 high
                            onInputChange('priceTimeSeries', newSeries);
                          }
                        }}
                        className="bg-white border border-purple-200 rounded p-3 text-left hover:bg-purple-100 transition-colors"
                      >
                        <div className="font-medium text-sm">Q1 High, Rest Low</div>
                        <div className="text-xs text-gray-600">Q1: $100, Others: $65</div>
                      </button>
                      
                      <button
                        onClick={() => {
                          const periods = calculateContractPeriods(formData.priceInterval || 'quarterly');
                          const basePrice = formData.strikePrice || 70;
                          const seasonalPrices = [];
                          
                          for (let i = 0; i < periods; i++) {
                            if (formData.priceInterval === 'quarterly') {
                              const quarterPrices = [80, 90, 95, 85];
                              seasonalPrices.push(quarterPrices[i % 4]);
                            } else {
                              seasonalPrices.push(basePrice + Math.sin(i * Math.PI / 6) * 10);
                            }
                          }
                          onInputChange('priceTimeSeries', seasonalPrices);
                        }}
                        className="bg-white border border-purple-200 rounded p-3 text-left hover:bg-purple-100 transition-colors"
                      >
                        <div className="font-medium text-sm">Seasonal Profile</div>
                        <div className="text-xs text-gray-600">Varying seasonal prices</div>
                      </button>
                      
                      <button
                        onClick={() => {
                          const periods = calculateContractPeriods(formData.priceInterval || 'quarterly');
                          const basePrice = formData.strikePrice || 70;
                          onInputChange('priceTimeSeries', Array(periods).fill(basePrice));
                        }}
                        className="bg-white border border-purple-200 rounded p-3 text-left hover:bg-purple-100 transition-colors"
                      >
                        <div className="font-medium text-sm">Flat Profile</div>
                        <div className="text-xs text-gray-600">All periods: Same price</div>
                      </button>
                    </div>
                  </div>

                  {/* Upload CSV Option */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Price Series (CSV)
                    </label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handlePriceDataUpload}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      CSV format: Price($/MWh). First row should be headers.
                    </p>
                  </div>

                  {/* Manual Price Input Grid */}
                  <div>
                    <h5 className="font-medium text-gray-800 mb-4">Price Configuration</h5>
                    
                    {formData.priceTimeSeries && formData.priceTimeSeries.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {formData.priceTimeSeries.map((price, index) => {
                          let periodLabel = '';
                          if (formData.priceInterval === 'monthly') {
                            periodLabel = months[index % 12];
                          } else if (formData.priceInterval === 'quarterly') {
                            periodLabel = `Q${(index % 4) + 1}`;
                          } else {
                            periodLabel = `Year ${index + 1}`;
                          }
                          
                          return (
                            <div key={index} className="bg-white border border-gray-200 rounded-lg p-3">
                              <label className="block text-xs text-gray-600 mb-1 font-medium">{periodLabel}</label>
                              <input
                                type="number"
                                value={price.toFixed(2)}
                                onChange={(e) => updateTimeSeriesPrice(index, parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                                step="0.01"
                                min="0"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {(!formData.priceTimeSeries || formData.priceTimeSeries.length === 0) && (
                      <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                        <p className="mb-2">No price series configured</p>
                        <p className="text-sm">Select an interval above or use a quick setup template</p>
                      </div>
                    )}
                  </div>

                  {/* Price Summary */}
                  {formData.priceTimeSeries && formData.priceTimeSeries.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h5 className="font-medium text-gray-800 mb-3">Price Summary</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Min Price:</span>
                          <div className="font-medium">${Math.min(...formData.priceTimeSeries).toFixed(2)}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Max Price:</span>
                          <div className="font-medium">${Math.max(...formData.priceTimeSeries).toFixed(2)}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Average:</span>
                          <div className="font-medium">
                            ${(formData.priceTimeSeries.reduce((a, b) => a + b, 0) / formData.priceTimeSeries.length).toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600">Range:</span>
                          <div className="font-medium">
                            ${(Math.max(...formData.priceTimeSeries) - Math.min(...formData.priceTimeSeries)).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Time-of-Day Pricing Configuration */}
            {currentPricingType === 'custom_time_of_day' && (
              <div className="border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">🕐 Time-of-Day Configuration</h4>
                
                <div className="space-y-6">
                  {/* Default Price */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Price ($/MWh)
                    </label>
                    <input
                      type="number"
                      value={formData.timeBasedPricing?.defaultPrice || formData.strikePrice || 0}
                      onChange={(e) => {
                        const current = formData.timeBasedPricing || { periods: [], defaultPrice: 0 };
                        onInputChange('timeBasedPricing', {
                          ...current,
                          defaultPrice: parseFloat(e.target.value) || 0
                        });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      step="0.01"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Price used when no specific time periods apply
                    </p>
                  </div>

                  {/* Add New Period */}
                  <div className="bg-orange-50 rounded-lg p-4">
                    <h5 className="font-medium text-orange-800 mb-3">Add Time Period</h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Period Name</label>
                        <input
                          type="text"
                          value={newPeriod.name}
                          onChange={(e) => setNewPeriod(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
                          placeholder="e.g., Peak Hours"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Price ($/MWh)</label>
                        <input
                          type="number"
                          value={newPeriod.price}
                          onChange={(e) => setNewPeriod(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
                          step="0.01"
                          min="0"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Start Time</label>
                        <input
                          type="time"
                          value={newPeriod.startTime}
                          onChange={(e) => setNewPeriod(prev => ({ ...prev, startTime: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">End Time</label>
                        <input
                          type="time"
                          value={newPeriod.endTime}
                          onChange={(e) => setNewPeriod(prev => ({ ...prev, endTime: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                    </div>

                    {/* Days of Week */}
                    <div className="mb-4">
                      <label className="block text-xs text-gray-600 mb-2">Days of Week</label>
                      <div className="flex gap-2">
                        {dayNames.map((day, index) => (
                          <label key={day} className="flex items-center text-sm">
                            <input
                              type="checkbox"
                              checked={newPeriod.daysOfWeek[index]}
                              onChange={(e) => {
                                const newDays = [...newPeriod.daysOfWeek];
                                newDays[index] = e.target.checked;
                                setNewPeriod(prev => ({ ...prev, daysOfWeek: newDays }));
                              }}
                              className="mr-1"
                            />
                            {day}
                          </label>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={addPricingPeriod}
                      className="bg-orange-500 text-white px-4 py-2 rounded font-medium hover:bg-orange-600 transition-colors"
                    >
                      Add Period
                    </button>
                  </div>

                  {/* Existing Periods */}
                  {formData.timeBasedPricing?.periods && formData.timeBasedPricing.periods.length > 0 && (
                    <div>
                      <h5 className="font-medium text-gray-800 mb-3">Configured Time Periods</h5>
                      <div className="space-y-3">
                        {formData.timeBasedPricing.periods.map((period) => (
                          <div key={period.id} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h6 className="font-medium text-gray-800">{period.name}</h6>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm text-gray-600">
                                  <div>
                                    <span className="font-medium">Price:</span> ${period.price}/MWh
                                  </div>
                                  <div>
                                    <span className="font-medium">Time:</span> {period.startTime} - {period.endTime}
                                  </div>
                                  <div className="md:col-span-2">
                                    <span className="font-medium">Days:</span> {
                                      period.daysOfWeek
                                        .map((active, index) => active ? dayNames[index] : null)
                                        .filter(Boolean)
                                        .join(', ')
                                    }
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => removePricingPeriod(period.id)}
                                className="text-red-500 hover:text-red-700 ml-4"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Validation Error */}
                  {errors.timeBasedPricing && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-800 text-sm">{errors.timeBasedPricing}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Escalation Application */}
            <div className="border-2 border-green-200 rounded-lg p-6 bg-green-50">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span>📈</span> Step 2: Apply Escalation (Optional)
              </h3>
              
              <div className="space-y-6">
                {/* Enable/Disable Escalation */}
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.escalationRate !== undefined && formData.escalationRate > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onInputChange('escalationRate', 2.5);
                          if (!formData.referenceDate) {
                            onInputChange('referenceDate', formData.startDate || '');
                          }
                        } else {
                          onInputChange('escalationRate', undefined);
                        }
                      }}
                      className="mr-2"
                    />
                    Apply annual escalation to the pricing structure above
                  </label>
                </div>

                {/* Escalation Configuration */}
                {formData.escalationRate !== undefined && formData.escalationRate > 0 && (
                  <div className="bg-white rounded-lg p-4 border border-green-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Annual Escalation Rate (%)
                        </label>
                        <input
                          type="number"
                          value={formData.escalationRate || ''}
                          onChange={(e) => onInputChange('escalationRate', parseFloat(e.target.value) || 0)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="e.g., 2.5"
                          min="0"
                          max="20"
                          step="0.1"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Reference Date *
                        </label>
                        <input
                          type="date"
                          value={formData.referenceDate}
                          onChange={(e) => onInputChange('referenceDate', e.target.value)}
                          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                            errors.referenceDate ? 'border-red-500 bg-red-50' : 'border-gray-300'
                          }`}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Ref date = +1 year after the price escalates by the CPI adjustment
                        </p>
                        {errors.referenceDate && <p className="mt-1 text-sm text-red-600">{errors.referenceDate}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          CPI Curve Preset
                        </label>
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              const preset = getCPIPreset(e.target.value);
                              onInputChange('escalationRate', preset.rate);
                            }
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          <option value="">Select CPI Preset...</option>
                          <option value="rba_quarterly">RBA Quarterly Forecast (2.5%)</option>
                          <option value="rba_annual">RBA Annual Target (2-3%)</option>
                          <option value="historical_avg">Historical 10yr Avg (2.8%)</option>
                          <option value="conservative">Conservative (2.0%)</option>
                          <option value="optimistic">Optimistic (3.5%)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Quick apply standard escalation rates
                        </p>
                      </div>
                    </div>

                    {/* Quick Apply Escalation Buttons for Time Series */}
                    {currentPricingType === 'timeseries' && formData.priceTimeSeries && formData.priceTimeSeries.length > 0 && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Quick Apply to Time Series
                        </label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const rate = formData.escalationRate || 2.5;
                              const updatedSeries = formData.priceTimeSeries!.map(price => price * (1 + rate / 100));
                              onInputChange('priceTimeSeries', updatedSeries);
                            }}
                            className="bg-green-500 text-white px-3 py-2 rounded text-sm hover:bg-green-600 transition-colors"
                          >
                            Apply {formData.escalationRate || 2.5}% to All Periods
                          </button>
                          <button
                            onClick={() => {
                              const rate = formData.escalationRate || 2.5;
                              const updatedSeries = formData.priceTimeSeries!.map(price => price / (1 + rate / 100));
                              onInputChange('priceTimeSeries', updatedSeries);
                            }}
                            className="bg-red-500 text-white px-3 py-2 rounded text-sm hover:bg-red-600 transition-colors"
                          >
                            Remove {formData.escalationRate || 2.5}% from All Periods
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Apply or remove escalation from your configured time series
                        </p>
                      </div>
                    )}

                    {/* Escalation Preview - Always Shown when escalation is enabled */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h5 className="font-medium text-gray-800">Escalation Preview</h5>
                        <button
                          onClick={() => setShowEscalationPreview(!showEscalationPreview)}
                          className="text-sm text-green-600 hover:text-green-800"
                        >
                          {showEscalationPreview ? 'Hide Details' : 'Show Details'}
                        </button>
                      </div>
                      
                      {/* Summary View - Always Visible */}
                      <div className="bg-green-100 rounded-lg p-4 mb-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                          <div className="bg-white rounded-lg p-3 border border-green-200">
                            <div className="text-sm text-gray-600">Starting Price</div>
                            <div className="text-xl font-bold text-green-600">
                              ${currentPricingType === 'timeseries' && formData.priceTimeSeries 
                                ? (formData.priceTimeSeries.reduce((a, b) => a + b, 0) / formData.priceTimeSeries.length).toFixed(2)
                                : formData.strikePrice.toFixed(2)
                              }
                            </div>
                            <div className="text-xs text-gray-500">
                              {currentPricingType === 'timeseries' ? 'Average Price' : 'Base Rate'}
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-green-200">
                            <div className="text-sm text-gray-600">Escalation</div>
                            <div className="text-xl font-bold text-blue-600">{formData.escalationRate}%</div>
                            <div className="text-xs text-gray-500">Per Annum</div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-green-200">
                            <div className="text-sm text-gray-600">Year 5 Price</div>
                            <div className="text-xl font-bold text-purple-600">
                              ${currentPricingType === 'timeseries' && formData.priceTimeSeries
                                ? ((formData.priceTimeSeries.reduce((a, b) => a + b, 0) / formData.priceTimeSeries.length) * Math.pow(1 + (formData.escalationRate / 100), 4)).toFixed(2)
                                : (formData.strikePrice * Math.pow(1 + (formData.escalationRate / 100), 4)).toFixed(2)
                              }
                            </div>
                            <div className="text-xs text-gray-500">After 4 Escalations</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Detailed View - Expandable */}
                      {showEscalationPreview && (
                        <div className="bg-green-100 rounded-lg p-4">
                          <h6 className="font-medium text-green-800 mb-3">Detailed Year-by-Year Breakdown</h6>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {generateEscalationPreview().map((price, index) => {
                              const escalationAmount = index === 0 ? 0 : price - generateEscalationPreview()[index - 1];
                              return (
                                <div key={index} className="bg-white border border-green-200 rounded-lg p-3 text-center">
                                  <div className="font-semibold text-gray-800 text-sm">Year {index + 1}</div>
                                  <div className="text-green-600 font-medium text-sm">${price.toFixed(2)}</div>
                                  {index > 0 && (
                                    <div className="text-xs text-gray-500">
                                      +${escalationAmount.toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-6 border-t border-gray-200 mt-8">
            <button
              onClick={onClose}
              className="bg-green-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-600 transition-colors"
            >
              Apply Changes
            </button>
            <button
              onClick={onClose}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}