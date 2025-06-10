'use client';

import { useState } from 'react';
import { Contract, SettingsData, TimeSeriesDataPoint, PriceCurve } from '@/app/types';

interface ContractPriceEditorProps {
  formData: Omit<Contract, '_id'>;
  errors: Record<string, string>;
  settings: SettingsData;
  onInputChange: (field: keyof Omit<Contract, '_id'>, value: any) => void;
  onClose: () => void;
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ContractPriceEditor({
  formData,
  errors,
  settings,
  onInputChange,
  onClose,
}: ContractPriceEditorProps) {
  const [priceDataFile, setPriceDataFile] = useState<File | null>(null);
  const [priceDataPreview, setPriceDataPreview] = useState<number[]>([]);
  const [priceSource, setPriceSource] = useState<'fixed' | 'timeseries'>(
    formData.pricingType === 'timeseries' ? 'timeseries' : 'fixed'
  );
  const [showPricePreview, setShowPricePreview] = useState(false);

  // Initialize pricing type if not set
  const currentPricingType = formData.pricingType || 'fixed';

  // Calculate contract periods for time series
  const calculateContractPeriods = (interval: 'monthly' | 'quarterly' | 'yearly') => {
    if (!formData.startDate || !formData.endDate) return 12; // Default fallback
    
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    
    if (interval === 'monthly') {
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
      return Math.max(1, months);
    } else if (interval === 'quarterly') {
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
      return Math.max(1, Math.ceil(months / 3));
    } else {
      const years = end.getFullYear() - start.getFullYear() + 1;
      return Math.max(1, years);
    }
  };

  // Handle pricing type change
  const handlePricingTypeChange = (type: 'fixed' | 'timeseries') => {
    setPriceSource(type);
    onInputChange('pricingType', type);
    
    if (type === 'timeseries') {
      const defaultInterval = 'quarterly';
      const periods = calculateContractPeriods(defaultInterval);
      onInputChange('priceTimeSeries', Array(periods).fill(formData.strikePrice || 70));
      onInputChange('priceInterval', defaultInterval);
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

      setPriceDataPreview(priceData.slice(0, 12));

      onInputChange('priceTimeSeries', priceData);
      onInputChange('pricingType', 'timeseries');
      
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

  // Generate time series from fixed price and contract dates
  const handleGenerateTimeSeries = () => {
    if (!formData.startDate || !formData.endDate || !formData.strikePrice) {
      alert('Please set start date, end date, and strike price first');
      return;
    }

    const defaultInterval = formData.priceInterval || 'quarterly';
    const periods = calculateContractPeriods(defaultInterval);
    const priceData = Array(periods).fill(formData.strikePrice);

    setPriceDataPreview(priceData.slice(0, 12));

    onInputChange('priceTimeSeries', priceData);
    onInputChange('pricingType', 'timeseries');
  };

  // Clear time series data and revert to fixed
  const handleClearTimeSeries = () => {
    onInputChange('priceTimeSeries', undefined);
    onInputChange('pricingType', 'fixed');
    setPriceDataPreview([]);
    setPriceSource('fixed');
  };

  // Update time series price
  const updateTimeSeriesPrice = (index: number, value: number) => {
    if (!formData.priceTimeSeries) return;

    const updatedSeries = [...formData.priceTimeSeries];
    updatedSeries[index] = value;
    onInputChange('priceTimeSeries', updatedSeries);
  };

  // Handle interval change
  const handleIntervalChange = (newInterval: 'monthly' | 'quarterly' | 'yearly') => {
    const oldInterval = formData.priceInterval || 'quarterly';
    const oldPrices = formData.priceTimeSeries || [];

    if (newInterval === oldInterval || oldPrices.length === 0) {
      onInputChange('priceInterval', newInterval);
      return;
    }

    const newPeriods = calculateContractPeriods(newInterval);
    let newPrices = Array(newPeriods).fill(formData.strikePrice || 70);

    if (oldInterval === 'quarterly' && newInterval === 'monthly') {
      newPrices = newPrices.map((_, monthIndex) => {
        const quarterIndex = Math.floor(monthIndex / 3);
        return oldPrices[quarterIndex % oldPrices.length];
      });
    }
    else if (oldInterval === 'monthly' && newInterval === 'quarterly') {
      newPrices = newPrices.map((_, quarterIndex) => {
        const startMonth = quarterIndex * 3;
        const endMonth = startMonth + 3;
        const monthsInQuarter = oldPrices.slice(startMonth, endMonth);

        if (monthsInQuarter.length === 0) return formData.strikePrice || 70;

        return monthsInQuarter.reduce((sum, price) => sum + price, 0) / monthsInQuarter.length;
      });
    }

    onInputChange('priceInterval', newInterval);
    onInputChange('priceTimeSeries', newPrices);
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
          {/* Price Data Source Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Price Data Source</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Fixed Price Option */}
              <div 
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  priceSource === 'fixed'
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handlePricingTypeChange('fixed')}
              >
                <div className="flex items-center mb-2">
                  <input
                    type="radio"
                    name="priceSource"
                    checked={priceSource === 'fixed'}
                    onChange={() => handlePricingTypeChange('fixed')}
                    className="mr-2"
                  />
                  <h4 className="font-semibold text-gray-800">Fixed Price</h4>
                </div>
                <p className="text-sm text-gray-600">
                  Use single fixed price for the entire contract duration
                </p>
              </div>

              {/* Time Series Option */}
              <div 
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  priceSource === 'timeseries' 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handlePricingTypeChange('timeseries')}
              >
                <div className="flex items-center mb-2">
                  <input
                    type="radio"
                    name="priceSource"
                    checked={priceSource === 'timeseries'}
                    onChange={() => handlePricingTypeChange('timeseries')}
                    className="mr-2"
                  />
                  <h4 className="font-semibold text-gray-800">Time Series</h4>
                </div>
                <p className="text-sm text-gray-600">
                  Use different prices for each period or upload actual data
                </p>
              </div>
            </div>
          </div>

          {/* Configuration Content Based on Source */}
          <div className="space-y-6">
            
            {/* Fixed Price Configuration */}
            {priceSource === 'fixed' && (
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

                {formData.timeSeriesData && formData.timeSeriesData.length > 0 && (
                  <div className="bg-green-50 rounded-lg p-4">
                    <h5 className="font-medium text-green-800 mb-2">✅ Current Price Time Series</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-green-600">Source:</span>
                        <div className="font-medium">Generated from fixed price</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPricePreview(!showPricePreview)}
                        className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
                      >
                        {showPricePreview ? 'Hide' : 'Show'} Generated Data
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Time Series Configuration */}
            {priceSource === 'timeseries' && (
              <div className="border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">📊 Time Series Configuration</h4>
                
                <div className="space-y-6">
                  {/* Contract Duration Info */}
                  {formData.startDate && formData.endDate && (
                    <div className="bg-purple-50 rounded-lg p-4">
                      <h5 className="font-medium text-purple-800 mb-2">Contract Duration</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-purple-600">Start Date:</span>
                          <div className="font-medium">{formData.startDate}</div>
                        </div>
                        <div>
                          <span className="text-purple-600">End Date:</span>
                          <div className="font-medium">{formData.endDate}</div>
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
                  )}

                  {/* Price Interval Selection */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="block text-sm font-medium text-gray-700">
                        Price Interval
                      </label>
                      
                      <select
                        value={formData.priceInterval || 'quarterly'}
                        onChange={(e) => handleIntervalChange(e.target.value as 'monthly' | 'quarterly' | 'yearly')}
                        className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="quarterly">Quarterly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
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
                        <p className="text-sm">Select an interval above or upload CSV data</p>
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

            {/* Escalation (Indexation) Module */}
            <div className="border-2 border-green-200 rounded-lg p-6 bg-green-50">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span>📈</span> Escalation (Indexation) - Optional
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        {errors.referenceDate && <p className="mt-1 text-sm text-red-600">{errors.referenceDate}</p>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-6 border-t border-gray-200 mt-8">
            <button
              onClick={() => {
                if (priceSource === 'fixed' && formData.startDate && formData.endDate && formData.strikePrice) {
                  handleGenerateTimeSeries();
                }
                onClose();
              }}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors"
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