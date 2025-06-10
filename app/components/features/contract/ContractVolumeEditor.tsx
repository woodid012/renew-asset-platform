'use client';

import { useState } from 'react';
import { Contract, SettingsData, TimeSeriesDataPoint, PriceCurve } from '@/app/types';

interface ContractVolumeEditorProps {
  formData: Omit<Contract, '_id'>;
  volumeShapes: { [key: string]: number[] };
  onInputChange: (field: keyof Omit<Contract, '_id'>, value: any) => void;
  onClose: () => void;
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Volume calculation utilities
const VolumeUtils = {
  hasMonthlyData: (contract: Omit<Contract, '_id'>): boolean => {
    return !!(contract.timeSeriesData && contract.timeSeriesData.length > 0);
  },

  calculateFromPercentages: (contract: Omit<Contract, '_id'>, volumeShapes: { [key: string]: number[] }): number[] => {
    const percentages = volumeShapes[contract.volumeShape] || volumeShapes.flat;
    return percentages.map(pct => (contract.annualVolume * pct) / 100);
  },

  calculateTotalVolume: (timeSeriesData: TimeSeriesDataPoint[]): number => {
    if (!timeSeriesData) return 0;
    return timeSeriesData.reduce((sum, data) => sum + data.volume, 0);
  },

  getYearsCovered: (timeSeriesData: TimeSeriesDataPoint[]): number[] => {
    if (!timeSeriesData) return [];
    
    const years = new Set<number>();
    timeSeriesData.forEach(data => {
      const year = parseInt(data.period.split('-')[0]);
      if (!isNaN(year)) {
        years.add(year);
      }
    });
    
    return Array.from(years).sort();
  },

  generateMonthlyData: (startDate: string, endDate: string, annualVolume: number, volumeShape: string, volumeShapes: { [key: string]: number[] }): TimeSeriesDataPoint[] => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const data: TimeSeriesDataPoint[] = [];
    
    const percentages = volumeShapes[volumeShape] || volumeShapes.flat;
    
    let currentDate = new Date(start);
    
    while (currentDate <= end) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const period = `${year}-${month.toString().padStart(2, '0')}`;
      
      const monthIndex = (currentDate.getMonth()) % 12;
      const monthlyVolume = (annualVolume * percentages[monthIndex]) / 100;
      
      data.push({
        period,
        volume: monthlyVolume
      });
      
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return data;
  }
};

export default function ContractVolumeEditor({
  formData,
  volumeShapes,
  onInputChange,
  onClose,
}: ContractVolumeEditorProps) {
  const [volumeDataFile, setVolumeDataFile] = useState<File | null>(null);
  const [volumeDataPreview, setVolumeDataPreview] = useState<TimeSeriesDataPoint[]>([]);
  const [volumeSource, setVolumeSource] = useState<'percentage' | 'timeseries'>(
    VolumeUtils.hasMonthlyData(formData) ? 'timeseries' : 'percentage'
  );
  const [showVolumePreview, setShowVolumePreview] = useState(false);

  // Calculate contract periods for time series (identical to price editor)
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

  // Handle volume source change (identical to price editor pattern)
  const handleVolumeSourceChange = (source: 'percentage' | 'timeseries') => {
    setVolumeSource(source);
    
    if (source === 'percentage') {
      handleClearTimeSeries();
    } else if (source === 'timeseries') {
      const defaultInterval = 'monthly';
      const periods = calculateContractPeriods(defaultInterval);
      onInputChange('volumeTimeSeries', Array(periods).fill(formData.annualVolume / 12 || 1000));
      onInputChange('volumeInterval', defaultInterval);
    }
  };

  // Generate time series from percentage and contract dates (updated to match price editor)
  const handleGenerateTimeSeries = () => {
    if (!formData.startDate || !formData.endDate || !formData.annualVolume) {
      alert('Please set start date, end date, and annual volume first');
      return;
    }

    const timeSeriesData = VolumeUtils.generateMonthlyData(
      formData.startDate,
      formData.endDate,
      formData.annualVolume,
      formData.volumeShape,
      volumeShapes
    );

    const totalVolume = VolumeUtils.calculateTotalVolume(timeSeriesData);
    const yearsCovered = VolumeUtils.getYearsCovered(timeSeriesData);

    setVolumeDataPreview(timeSeriesData.slice(0, 12));

    onInputChange('timeSeriesData', timeSeriesData);
    onInputChange('totalVolume', totalVolume);
    onInputChange('yearsCovered', yearsCovered);
    onInputChange('dataSource', 'manual');
  };

  // Clear time series data and revert to percentage (identical to price editor)
  const handleClearTimeSeries = () => {
    onInputChange('timeSeriesData', undefined);
    onInputChange('volumeTimeSeries', undefined);
    onInputChange('totalVolume', undefined);
    onInputChange('yearsCovered', undefined);
    onInputChange('dataSource', 'manual');
    setVolumeDataPreview([]);
    setVolumeSource('percentage');
  };

  // Update time series volume (identical to price editor pattern)
  const updateTimeSeriesVolume = (index: number, value: number) => {
    if (!formData.volumeTimeSeries) return;

    const updatedSeries = [...formData.volumeTimeSeries];
    updatedSeries[index] = value;
    onInputChange('volumeTimeSeries', updatedSeries);

    // Also update timeSeriesData for consistency
    if (formData.timeSeriesData) {
      const updatedTimeSeriesData = [...formData.timeSeriesData];
      if (updatedTimeSeriesData[index]) {
        updatedTimeSeriesData[index].volume = value;
        onInputChange('timeSeriesData', updatedTimeSeriesData);
        
        // Recalculate totals
        const totalVolume = VolumeUtils.calculateTotalVolume(updatedTimeSeriesData);
        onInputChange('totalVolume', totalVolume);
      }
    }
  };

  // Handle interval change (identical to price editor)
  const handleIntervalChange = (newInterval: 'monthly' | 'quarterly' | 'yearly') => {
    const oldInterval = formData.volumeInterval || 'monthly';
    const oldVolumes = formData.volumeTimeSeries || [];

    if (newInterval === oldInterval || oldVolumes.length === 0) {
      onInputChange('volumeInterval', newInterval);
      return;
    }

    const newPeriods = calculateContractPeriods(newInterval);
    let newVolumes = Array(newPeriods).fill(formData.annualVolume / 12 || 1000);

    if (oldInterval === 'quarterly' && newInterval === 'monthly') {
      newVolumes = newVolumes.map((_, monthIndex) => {
        const quarterIndex = Math.floor(monthIndex / 3);
        return oldVolumes[quarterIndex % oldVolumes.length];
      });
    }
    else if (oldInterval === 'monthly' && newInterval === 'quarterly') {
      newVolumes = newVolumes.map((_, quarterIndex) => {
        const startMonth = quarterIndex * 3;
        const endMonth = startMonth + 3;
        const monthsInQuarter = oldVolumes.slice(startMonth, endMonth);

        if (monthsInQuarter.length === 0) return formData.annualVolume / 4 || 250;

        return monthsInQuarter.reduce((sum, volume) => sum + volume, 0) / monthsInQuarter.length;
      });
    }

    onInputChange('volumeInterval', newInterval);
    onInputChange('volumeTimeSeries', newVolumes);
  };

  // Handle CSV volume data upload (identical structure to price editor)
  const handleVolumeDataUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setVolumeDataFile(file);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
      
      const periodIndex = headers.findIndex(h => h.includes('period') || h.includes('date') || h.includes('month'));
      const volumeIndex = headers.findIndex(h => h.includes('volume') || h.includes('mwh') || h.includes('energy'));
      
      if (periodIndex === -1 || volumeIndex === -1) {
        alert('CSV must have columns for period (date/month) and volume (MWh)');
        return;
      }

      const timeSeriesData: TimeSeriesDataPoint[] = [];
      
      lines.slice(1).forEach(line => {
        const cells = line.split(',');
        const periodStr = cells[periodIndex]?.trim();
        const volumeStr = cells[volumeIndex]?.trim();
        
        if (!periodStr || !volumeStr) return;
        
        let period = '';
        if (periodStr.match(/^\d{4}-\d{2}$/)) {
          period = periodStr;
        } else if (periodStr.match(/^\d{1,2}\/\d{4}$/)) {
          const [month, year] = periodStr.split('/');
          period = `${year}-${month.padStart(2, '0')}`;
        } else if (periodStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          period = periodStr.substring(0, 7);
        }
        
        const volume = parseFloat(volumeStr);
        if (period && !isNaN(volume)) {
          timeSeriesData.push({ period, volume });
        }
      });

      if (timeSeriesData.length === 0) {
        alert('No valid volume data found in CSV');
        return;
      }

      const totalVolume = VolumeUtils.calculateTotalVolume(timeSeriesData);
      const yearsCovered = VolumeUtils.getYearsCovered(timeSeriesData);

      setVolumeDataPreview(timeSeriesData.slice(0, 12));

      onInputChange('timeSeriesData', timeSeriesData);
      onInputChange('totalVolume', totalVolume);
      onInputChange('yearsCovered', yearsCovered);
      onInputChange('dataSource', 'csv_import');
      onInputChange('annualVolume', totalVolume);

    } catch (error) {
      console.error('Error parsing volume file:', error);
      alert('Error parsing volume file. Please ensure it\'s a valid CSV with period and volume columns.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              📊 Volume Configuration
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
          {/* Volume Data Source Selection (identical to price editor) */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Volume Data Source</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Percentage-Based Option */}
              <div 
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  volumeSource === 'percentage'
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleVolumeSourceChange('percentage')}
              >
                <div className="flex items-center mb-2">
                  <input
                    type="radio"
                    name="volumeSource"
                    checked={volumeSource === 'percentage'}
                    onChange={() => handleVolumeSourceChange('percentage')}
                    className="mr-2"
                  />
                  <h4 className="font-semibold text-gray-800">Generate from Volume Shape</h4>
                </div>
                <p className="text-sm text-gray-600">
                  Use annual volume + volume shapes (flat, solar, wind, custom) to generate time series
                </p>
              </div>

              {/* Time Series Option */}
              <div 
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  volumeSource === 'timeseries' 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleVolumeSourceChange('timeseries')}
              >
                <div className="flex items-center mb-2">
                  <input
                    type="radio"
                    name="volumeSource"
                    checked={volumeSource === 'timeseries'}
                    onChange={() => handleVolumeSourceChange('timeseries')}
                    className="mr-2"
                  />
                  <h4 className="font-semibold text-gray-800">Time Series</h4>
                </div>
                <p className="text-sm text-gray-600">
                  Use different volumes for each period or upload actual data
                </p>
              </div>
            </div>
          </div>

          {/* Configuration Content Based on Source */}
          <div className="space-y-6">
            
            {/* Percentage-Based Configuration */}
            {volumeSource === 'percentage' && (
              <div className="border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">📊 Generate Volume Time Series</h4>
                
                {/* Contract Duration Info */}
                {formData.startDate && formData.endDate && (
                  <div className="bg-blue-50 rounded-lg p-4 mb-6">
                    <h5 className="font-medium text-blue-800 mb-2">Contract Duration</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-blue-600">Start Date:</span>
                        <div className="font-medium">{formData.startDate}</div>
                      </div>
                      <div>
                        <span className="text-blue-600">End Date:</span>
                        <div className="font-medium">{formData.endDate}</div>
                      </div>
                      <div>
                        <span className="text-blue-600">Contract Months:</span>
                        <div className="font-medium">{calculateContractPeriods('monthly')}</div>
                      </div>
                      <div>
                        <span className="text-blue-600">Volume Shape:</span>
                        <div className="font-medium capitalize">{formData.volumeShape}</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Annual Volume */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Annual Volume (MWh) *
                    </label>
                    <input
                      type="number"
                      value={formData.annualVolume || ''}
                      onChange={(e) => onInputChange('annualVolume', parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter annual volume in MWh"
                      min="0"
                      step="1000"
                    />
                  </div>

                  {/* Volume Shape */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Volume Shape
                    </label>
                    <select
                      value={formData.volumeShape}
                      onChange={(e) => onInputChange('volumeShape', e.target.value as Contract['volumeShape'])}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="flat">Flat</option>
                      <option value="solar">Solar</option>
                      <option value="wind">Wind</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>

                {/* Volume Shape Preview - Always Show */}
                {formData.annualVolume > 0 && (
                  <div className="mb-6">
                    <h5 className="font-medium text-gray-800 mb-4">Monthly Volume Shape Preview</h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                      {months.map((month, index) => {
                        const percentage = volumeShapes[formData.volumeShape]?.[index] || 8.33;
                        const monthlyVolume = (formData.annualVolume * percentage) / 100;
                        
                        return (
                          <div key={month} className="bg-white border border-gray-200 rounded-lg p-3 text-center hover:bg-gray-50 transition-colors">
                            <div className="font-semibold text-gray-800 text-sm">{month}</div>
                            <div className="text-blue-600 font-medium text-sm">{percentage.toFixed(1)}%</div>
                            <div className="text-gray-600 text-xs">{monthlyVolume.toLocaleString(undefined, {maximumFractionDigits: 0})} MWh</div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mt-3 text-center">
                      This pattern will be applied across the entire contract duration when you apply changes
                    </p>
                  </div>
                )}

                {/* Current Generated Data Status */}
                {formData.timeSeriesData && formData.timeSeriesData.length > 0 && (
                  <div className="bg-green-50 rounded-lg p-4">
                    <h5 className="font-medium text-green-800 mb-2">✅ Current Volume Time Series</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-green-600">Data Points:</span>
                        <div className="font-medium">{formData.timeSeriesData.length} months</div>
                      </div>
                      <div>
                        <span className="text-green-600">Total Volume:</span>
                        <div className="font-medium">{formData.totalVolume?.toLocaleString() || 0} MWh</div>
                      </div>
                      <div>
                        <span className="text-green-600">Years Covered:</span>
                        <div className="font-medium">{formData.yearsCovered?.join(', ') || 'None'}</div>
                      </div>
                      <div>
                        <span className="text-green-600">Source:</span>
                        <div className="font-medium">Generated from {formData.volumeShape} shape</div>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setShowVolumePreview(!showVolumePreview)}
                      className="mt-3 text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
                    >
                      {showVolumePreview ? 'Hide' : 'Show'} Generated Data
                    </button>
                    
                    {showVolumePreview && (
                      <div className="mt-4 max-h-60 overflow-y-auto">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {formData.timeSeriesData.slice(0, 24).map((data, index) => (
                            <div key={index} className="bg-white border border-green-200 rounded p-2 text-center text-xs">
                              <div className="text-green-600 font-medium">{data.period}</div>
                              <div className="text-gray-700">{data.volume.toFixed(0)} MWh</div>
                            </div>
                          ))}
                        </div>
                        {formData.timeSeriesData.length > 24 && (
                          <p className="text-center text-gray-500 text-xs mt-2">
                            ... and {formData.timeSeriesData.length - 24} more periods
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Time Series Configuration */}
            {volumeSource === 'timeseries' && (
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

                  {/* Volume Interval Selection */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="block text-sm font-medium text-gray-700">
                        Volume Interval
                      </label>
                      
                      <select
                        value={formData.volumeInterval || 'monthly'}
                        onChange={(e) => handleIntervalChange(e.target.value as 'monthly' | 'quarterly' | 'yearly')}
                        className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                  </div>

                  {/* Upload CSV Option */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Volume Series (CSV)
                    </label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleVolumeDataUpload}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      CSV format: Period (YYYY-MM), Volume(MWh). First row should be headers.
                      Supports formats: YYYY-MM, MM/YYYY, YYYY-MM-DD
                    </p>
                  </div>

                  {/* Manual Volume Input Grid */}
                  <div>
                    <h5 className="font-medium text-gray-800 mb-4">Volume Configuration</h5>
                    
                    {formData.volumeTimeSeries && formData.volumeTimeSeries.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {formData.volumeTimeSeries.map((volume, index) => {
                          let periodLabel = '';
                          if (formData.volumeInterval === 'monthly') {
                            periodLabel = months[index % 12];
                          } else if (formData.volumeInterval === 'quarterly') {
                            periodLabel = `Q${(index % 4) + 1}`;
                          } else {
                            periodLabel = `Year ${index + 1}`;
                          }
                          
                          return (
                            <div key={index} className="bg-white border border-gray-200 rounded-lg p-3">
                              <label className="block text-xs text-gray-600 mb-1 font-medium">{periodLabel}</label>
                              <input
                                type="number"
                                value={volume.toFixed(0)}
                                onChange={(e) => updateTimeSeriesVolume(index, parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                                step="1000"
                                min="0"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {(!formData.volumeTimeSeries || formData.volumeTimeSeries.length === 0) && (
                      <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                        <p className="mb-2">No volume series configured</p>
                        <p className="text-sm">Select an interval above or upload CSV data</p>
                      </div>
                    )}
                  </div>

                  {/* Volume Summary */}
                  {formData.volumeTimeSeries && formData.volumeTimeSeries.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h5 className="font-medium text-gray-800 mb-3">Volume Summary</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Min Volume:</span>
                          <div className="font-medium">{Math.min(...formData.volumeTimeSeries).toLocaleString()} MWh</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Max Volume:</span>
                          <div className="font-medium">{Math.max(...formData.volumeTimeSeries).toLocaleString()} MWh</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Total:</span>
                          <div className="font-medium">
                            {formData.volumeTimeSeries.reduce((a, b) => a + b, 0).toLocaleString()} MWh
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600">Average:</span>
                          <div className="font-medium">
                            {(formData.volumeTimeSeries.reduce((a, b) => a + b, 0) / formData.volumeTimeSeries.length).toLocaleString()} MWh
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.timeSeriesData && formData.timeSeriesData.length > 0 && (
                    <div className="bg-green-50 rounded-lg p-4">
                      <h5 className="font-medium text-green-800 mb-2">✅ Volume Time Series Loaded</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-green-600">Data Points:</span>
                          <div className="font-medium">{formData.timeSeriesData.length}</div>
                        </div>
                        <div>
                          <span className="text-green-600">Total Volume:</span>
                          <div className="font-medium">{formData.totalVolume?.toLocaleString() || 0} MWh</div>
                        </div>
                        <div>
                          <span className="text-green-600">Years Covered:</span>
                          <div className="font-medium">{formData.yearsCovered?.join(', ') || 'None'}</div>
                        </div>
                        <div>
                          <span className="text-green-600">Source:</span>
                          <div className="font-medium">CSV Import</div>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setShowVolumePreview(!showVolumePreview)}
                        className="mt-3 text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
                      >
                        {showVolumePreview ? 'Hide' : 'Show'} Data Preview
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Volume Data Preview */}
            {formData.timeSeriesData && formData.timeSeriesData.length > 0 && showVolumePreview && (
              <div className="border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">📈 Volume Time Series Preview</h4>
                
                <div className="max-h-60 overflow-y-auto">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {(volumeDataPreview.length > 0 ? volumeDataPreview : formData.timeSeriesData.slice(0, 12)).map((data, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                        <div className="font-semibold text-gray-800 text-sm">{data.period}</div>
                        <div className="text-green-600 font-medium text-sm">{data.volume.toFixed(0)} MWh</div>
                      </div>
                    ))}
                  </div>
                  
                  {formData.timeSeriesData.length > 12 && (
                    <p className="text-center text-gray-500 text-sm mt-3">
                      ... and {formData.timeSeriesData.length - 12} more periods
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
                // Auto-generate time series if using volume shapes
                if (volumeSource === 'percentage' && formData.startDate && formData.endDate && formData.annualVolume) {
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