'use client';

import { useState } from 'react';
import { Contract, SettingsData, TimeSeriesDataPoint, PriceCurve } from '@/app/types';

interface ContractLWPEditorProps {
  formData: Omit<Contract, '_id'>;
  errors: Record<string, string>;
  settings: SettingsData;
  onInputChange: (field: keyof Omit<Contract, '_id'>, value: any) => void;
  onClose: () => void;
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ContractLWPEditor({
  formData,
  errors,
  settings,
  onInputChange,
  onClose,
}: ContractLWPEditorProps) {
  const [lwpDataFile, setLwpDataFile] = useState<File | null>(null);
  const [lwpDataPreview, setLwpDataPreview] = useState<number[]>([]);
  const [lwpSource, setLwpSource] = useState<'fixed' | 'timeseries'>(
    formData.lwpTimeSeries && formData.lwpTimeSeries.length > 0 ? 'timeseries' : 'fixed'
  );
  const [showLwpPreview, setShowLwpPreview] = useState(false);

  // Initialize LWP percentage if not set
  const currentLwpPercentage = formData.lwpPercentage || 100;

  // Calculate contract periods for time series (identical to price/volume editors)
  const calculateContractPeriods = (interval: 'monthly' | 'quarterly' | 'yearly') => {
    if (!formData.startDate || !formData.endDate) return 12;
    
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

  // Handle LWP source change
  const handleLwpSourceChange = (source: 'fixed' | 'timeseries') => {
    setLwpSource(source);
    
    if (source === 'timeseries') {
      const defaultInterval = 'quarterly';
      const periods = calculateContractPeriods(defaultInterval);
      onInputChange('lwpTimeSeries', Array(periods).fill(currentLwpPercentage));
      onInputChange('lwpInterval', defaultInterval);
    } else {
      // Clear time series when switching to fixed
      onInputChange('lwpTimeSeries', undefined);
      onInputChange('lwpInterval', undefined);
    }
  };

  // Handle CSV LWP data upload
  const handleLwpDataUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLwpDataFile(file);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].toLowerCase().split(',');
      
      const lwpIndex = headers.findIndex(h => 
        h.includes('lwp') || h.includes('load weighted') || h.includes('percentage') || h.includes('%')
      );
      
      if (lwpIndex === -1) {
        alert('CSV must have a column for LWP (Load Weighted Price percentage)');
        return;
      }

      const lwpData: number[] = [];
      
      lines.slice(1).forEach(line => {
        const cells = line.split(',');
        const lwpStr = cells[lwpIndex]?.trim();
        
        if (!lwpStr) return;
        
        // Handle percentage format - remove % if present
        const cleanLwpStr = lwpStr.replace('%', '');
        const lwp = parseFloat(cleanLwpStr);
        
        if (!isNaN(lwp)) {
          // Convert to percentage if it looks like a decimal (0.95 -> 95%)
          const percentage = lwp <= 5 ? lwp * 100 : lwp;
          lwpData.push(percentage);
        }
      });

      if (lwpData.length === 0) {
        alert('No valid LWP data found in CSV');
        return;
      }

      setLwpDataPreview(lwpData.slice(0, 12));

      onInputChange('lwpTimeSeries', lwpData);
      
      // Set interval based on data length
      if (lwpData.length <= 4) {
        onInputChange('lwpInterval', 'quarterly');
      } else if (lwpData.length <= 12) {
        onInputChange('lwpInterval', 'monthly');
      } else {
        onInputChange('lwpInterval', 'monthly');
      }

    } catch (error) {
      console.error('Error parsing LWP file:', error);
      alert('Error parsing LWP file. Please ensure it\'s a valid CSV with LWP percentage columns.');
    }
  };

  // Generate time series from fixed LWP and contract dates
  const handleGenerateTimeSeries = () => {
    if (!formData.startDate || !formData.endDate) {
      alert('Please set start date and end date first');
      return;
    }

    const defaultInterval = formData.lwpInterval || 'quarterly';
    const periods = calculateContractPeriods(defaultInterval);
    const lwpData = Array(periods).fill(currentLwpPercentage);

    setLwpDataPreview(lwpData.slice(0, 12));

    onInputChange('lwpTimeSeries', lwpData);
  };

  // Clear time series data and revert to fixed
  const handleClearTimeSeries = () => {
    onInputChange('lwpTimeSeries', undefined);
    onInputChange('lwpInterval', undefined);
    setLwpDataPreview([]);
    setLwpSource('fixed');
  };

  // Update time series LWP
  const updateTimeSeriesLwp = (index: number, value: number) => {
    if (!formData.lwpTimeSeries) return;

    const updatedSeries = [...formData.lwpTimeSeries];
    updatedSeries[index] = value;
    onInputChange('lwpTimeSeries', updatedSeries);
  };

  // Handle interval change
  const handleIntervalChange = (newInterval: 'monthly' | 'quarterly' | 'yearly') => {
    const oldInterval = formData.lwpInterval || 'quarterly';
    const oldLwps = formData.lwpTimeSeries || [];

    if (newInterval === oldInterval || oldLwps.length === 0) {
      onInputChange('lwpInterval', newInterval);
      return;
    }

    const newPeriods = calculateContractPeriods(newInterval);
    let newLwps = Array(newPeriods).fill(currentLwpPercentage);

    if (oldInterval === 'quarterly' && newInterval === 'monthly') {
      newLwps = newLwps.map((_, monthIndex) => {
        const quarterIndex = Math.floor(monthIndex / 3);
        return oldLwps[quarterIndex % oldLwps.length];
      });
    }
    else if (oldInterval === 'monthly' && newInterval === 'quarterly') {
      newLwps = newLwps.map((_, quarterIndex) => {
        const startMonth = quarterIndex * 3;
        const endMonth = startMonth + 3;
        const monthsInQuarter = oldLwps.slice(startMonth, endMonth);

        if (monthsInQuarter.length === 0) return currentLwpPercentage;

        return monthsInQuarter.reduce((sum, lwp) => sum + lwp, 0) / monthsInQuarter.length;
      });
    }

    onInputChange('lwpInterval', newInterval);
    onInputChange('lwpTimeSeries', newLwps);
  };

  // Validate LWP percentage value
  const validateLwpValue = (value: number): string => {
    if (value < 0) return 'LWP percentage cannot be negative';
    if (value > 200) return 'LWP percentage seems unusually high (>200%)';
    if (value < 50) return 'LWP percentage seems unusually low (<50%)';
    return '';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              ⚖️ Load Weighted Price (LWP) Configuration
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
          {/* LWP Explanation */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">💡 About Load Weighted Price (LWP)</h3>
            <p className="text-blue-700 text-sm mb-2">
              LWP adjusts market prices based on your generation or consumption profile relative to the market average.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <strong className="text-blue-800">100% LWP:</strong>
                <div className="text-blue-600">Market price (no adjustment)</div>
              </div>
              <div>
                <strong className="text-blue-800">95% LWP:</strong>
                <div className="text-blue-600">5% discount to market price</div>
              </div>
              <div>
                <strong className="text-blue-800">105% LWP:</strong>
                <div className="text-blue-600">5% premium to market price</div>
              </div>
            </div>
          </div>

          {/* LWP Data Source Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">LWP Data Source</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Fixed LWP Option */}
              <div 
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  lwpSource === 'fixed'
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleLwpSourceChange('fixed')}
              >
                <div className="flex items-center mb-2">
                  <input
                    type="radio"
                    name="lwpSource"
                    checked={lwpSource === 'fixed'}
                    onChange={() => handleLwpSourceChange('fixed')}
                    className="mr-2"
                  />
                  <h4 className="font-semibold text-gray-800">Fixed LWP Percentage</h4>
                </div>
                <p className="text-sm text-gray-600">
                  Use single LWP percentage for the entire contract duration
                </p>
              </div>

              {/* Time Series Option */}
              <div 
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  lwpSource === 'timeseries' 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleLwpSourceChange('timeseries')}
              >
                <div className="flex items-center mb-2">
                  <input
                    type="radio"
                    name="lwpSource"
                    checked={lwpSource === 'timeseries'}
                    onChange={() => handleLwpSourceChange('timeseries')}
                    className="mr-2"
                  />
                  <h4 className="font-semibold text-gray-800">Time Series LWP</h4>
                </div>
                <p className="text-sm text-gray-600">
                  Use different LWP percentages for each period or upload actual data
                </p>
              </div>
            </div>
          </div>

          {/* Configuration Content Based on Source */}
          <div className="space-y-6">
            
            {/* Fixed LWP Configuration */}
            {lwpSource === 'fixed' && (
              <div className="border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">⚖️ Fixed LWP Configuration</h4>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    LWP Percentage (%) *
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      value={currentLwpPercentage}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 100;
                        onInputChange('lwpPercentage', value);
                      }}
                      className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="100"
                      min="0"
                      max="200"
                      step="0.1"
                    />
                    <span className="text-gray-600">%</span>
                    <div className="flex-1 text-sm text-gray-600">
                      {currentLwpPercentage === 100 ? (
                        'Market price (no adjustment)'
                      ) : currentLwpPercentage < 100 ? (
                        `${(100 - currentLwpPercentage).toFixed(1)}% discount to market price`
                      ) : (
                        `${(currentLwpPercentage - 100).toFixed(1)}% premium to market price`
                      )}
                    </div>
                  </div>
                  
                  {(() => {
                    const warning = validateLwpValue(currentLwpPercentage);
                    return warning ? (
                      <p className="mt-1 text-sm text-yellow-600">⚠️ {warning}</p>
                    ) : null;
                  })()}
                </div>

                {/* LWP Notes */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    LWP Notes (Optional)
                  </label>
                  <textarea
                    value={formData.lwpNotes || ''}
                    onChange={(e) => onInputChange('lwpNotes', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Optional notes about this LWP configuration..."
                  />
                </div>

                {formData.lwpTimeSeries && formData.lwpTimeSeries.length > 0 && (
                  <div className="bg-green-50 rounded-lg p-4">
                    <h5 className="font-medium text-green-800 mb-2">✅ Current LWP Time Series</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-green-600">Source:</span>
                        <div className="font-medium">Generated from fixed LWP</div>
                      </div>
                      <div>
                        <span className="text-green-600">Periods:</span>
                        <div className="font-medium">{formData.lwpTimeSeries.length}</div>
                      </div>
                      <div>
                        <span className="text-green-600">Interval:</span>
                        <div className="font-medium capitalize">{formData.lwpInterval || 'quarterly'}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowLwpPreview(!showLwpPreview)}
                        className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
                      >
                        {showLwpPreview ? 'Hide' : 'Show'} Generated Data
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Time Series Configuration */}
            {lwpSource === 'timeseries' && (
              <div className="border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">📊 Time Series LWP Configuration</h4>
                
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

                  {/* LWP Interval Selection */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="block text-sm font-medium text-gray-700">
                        LWP Interval
                      </label>
                      
                      <select
                        value={formData.lwpInterval || 'quarterly'}
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
                      Upload LWP Series (CSV)
                    </label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleLwpDataUpload}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      CSV format: LWP(%). First row should be headers. Supports 95.5 or 95.5% formats.
                    </p>
                  </div>

                  {/* Manual LWP Input Grid */}
                  <div>
                    <h5 className="font-medium text-gray-800 mb-4">LWP Configuration</h5>
                    
                    {formData.lwpTimeSeries && formData.lwpTimeSeries.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {formData.lwpTimeSeries.map((lwp, index) => {
                          let periodLabel = '';
                          if (formData.lwpInterval === 'monthly') {
                            periodLabel = months[index % 12];
                          } else if (formData.lwpInterval === 'quarterly') {
                            periodLabel = `Q${(index % 4) + 1}`;
                          } else {
                            periodLabel = `Year ${index + 1}`;
                          }
                          
                          return (
                            <div key={index} className="bg-white border border-gray-200 rounded-lg p-3">
                              <label className="block text-xs text-gray-600 mb-1 font-medium">{periodLabel}</label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={lwp.toFixed(1)}
                                  onChange={(e) => updateTimeSeriesLwp(index, parseFloat(e.target.value) || 0)}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                                  step="0.1"
                                  min="0"
                                  max="200"
                                />
                                <span className="text-xs text-gray-500">%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {(!formData.lwpTimeSeries || formData.lwpTimeSeries.length === 0) && (
                      <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                        <p className="mb-2">No LWP series configured</p>
                        <p className="text-sm">Select an interval above or upload CSV data</p>
                      </div>
                    )}
                  </div>

                  {/* LWP Summary */}
                  {formData.lwpTimeSeries && formData.lwpTimeSeries.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h5 className="font-medium text-gray-800 mb-3">LWP Summary</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Min LWP:</span>
                          <div className="font-medium">{Math.min(...formData.lwpTimeSeries).toFixed(1)}%</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Max LWP:</span>
                          <div className="font-medium">{Math.max(...formData.lwpTimeSeries).toFixed(1)}%</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Average:</span>
                          <div className="font-medium">
                            {(formData.lwpTimeSeries.reduce((a, b) => a + b, 0) / formData.lwpTimeSeries.length).toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600">Range:</span>
                          <div className="font-medium">
                            {(Math.max(...formData.lwpTimeSeries) - Math.min(...formData.lwpTimeSeries)).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LWP Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      LWP Notes (Optional)
                    </label>
                    <textarea
                      value={formData.lwpNotes || ''}
                      onChange={(e) => onInputChange('lwpNotes', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      rows={3}
                      placeholder="Optional notes about this LWP configuration..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* LWP Data Preview */}
            {formData.lwpTimeSeries && formData.lwpTimeSeries.length > 0 && showLwpPreview && (
              <div className="border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">📈 LWP Time Series Preview</h4>
                
                <div className="max-h-60 overflow-y-auto">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {(lwpDataPreview.length > 0 ? lwpDataPreview : formData.lwpTimeSeries.slice(0, 12)).map((lwp, index) => {
                      let periodLabel = '';
                      if (formData.lwpInterval === 'monthly') {
                        periodLabel = months[index % 12];
                      } else if (formData.lwpInterval === 'quarterly') {
                        periodLabel = `Q${(index % 4) + 1}`;
                      } else {
                        periodLabel = `Year ${index + 1}`;
                      }
                      
                      return (
                        <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                          <div className="font-semibold text-gray-800 text-sm">{periodLabel}</div>
                          <div className="text-purple-600 font-medium text-sm">{lwp.toFixed(1)}%</div>
                          <div className="text-xs text-gray-500">
                            {lwp === 100 ? 'Market' : 
                             lwp < 100 ? `${(100 - lwp).toFixed(1)}% disc.` : 
                             `${(lwp - 100).toFixed(1)}% prem.`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {formData.lwpTimeSeries.length > 12 && (
                    <p className="text-center text-gray-500 text-sm mt-3">
                      ... and {formData.lwpTimeSeries.length - 12} more periods
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-6 border-t border-gray-200 mt-8">
            <button
              onClick={() => {
                // Auto-generate time series if using fixed LWP
                if (lwpSource === 'fixed' && formData.startDate && formData.endDate) {
                  handleGenerateTimeSeries();
                }
                onClose();
              }}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors"
            >
              Apply Changes
            </button>
            <button
              onClick={() => {
                if (formData.lwpTimeSeries && formData.lwpTimeSeries.length > 0) {
                  const confirm = window.confirm('Clear LWP time series data and revert to fixed LWP?');
                  if (confirm) {
                    handleClearTimeSeries();
                  }
                }
                onClose();
              }}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              {formData.lwpTimeSeries && formData.lwpTimeSeries.length > 0 ? 'Clear & Close' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}