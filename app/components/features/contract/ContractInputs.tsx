'use client';

import { useState, useEffect } from 'react';

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
  pricingType?: 'fixed' | 'escalation' | 'timeseries' | 'custom_time_of_day';
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

interface EnhancedContractInputsProps {
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

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Volume calculation utilities
const VolumeUtils = {
  hasMonthlyData: (contract: Contract): boolean => {
    return !!(contract.timeSeriesData && contract.timeSeriesData.length > 0);
  },

  getMonthlyVolumes: (contract: Contract, year: number): number[] => {
    if (!contract.timeSeriesData) {
      return VolumeUtils.calculateFromPercentages(contract);
    }

    const monthlyVolumes = new Array(12).fill(0);
    
    contract.timeSeriesData.forEach(data => {
      const [dataYear, dataMonth] = data.period.split('-').map(Number);
      
      if (dataYear === year && dataMonth >= 1 && dataMonth <= 12) {
        monthlyVolumes[dataMonth - 1] = data.volume;
      }
    });

    return monthlyVolumes;
  },

  calculateFromPercentages: (contract: Contract): number[] => {
    const volumeShapes = {
      flat: [8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33],
      solar: [6.5, 7.2, 8.8, 9.5, 10.2, 8.9, 9.1, 9.8, 8.6, 7.4, 6.8, 7.2],
      wind: [11.2, 10.8, 9.2, 7.8, 6.5, 5.9, 6.2, 7.1, 8.4, 9.6, 10.8, 11.5],
      custom: [5.0, 6.0, 7.5, 9.0, 11.0, 12.5, 13.0, 12.0, 10.5, 8.5, 7.0, 6.0]
    };

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

  calculateEndDate: (startDate: string, tenor: { value: number; unit: 'months' | 'years' }): string => {
    const start = new Date(startDate);
    let endDate = new Date(start);

    if (tenor.unit === 'months') {
      endDate.setMonth(endDate.getMonth() + tenor.value);
    } else {
      endDate.setFullYear(endDate.getFullYear() + tenor.value);
    }

    // Round to end of month
    endDate = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
    
    return endDate.toISOString().split('T')[0];
  }
};

export default function EnhancedContractInputs({
  formData,
  isEditing,
  errors,
  settings,
  volumeShapes,
  onInputChange,
  onSave,
  onCancel,
  isSaving,
}: EnhancedContractInputsProps) {
  const [volumeDataFile, setVolumeDataFile] = useState<File | null>(null);
  const [volumeDataPreview, setVolumeDataPreview] = useState<TimeSeriesDataPoint[]>([]);
  const [showVolumeEditor, setShowVolumeEditor] = useState(false);

  if (!formData) return null;

  // Initialize default start date to current year
  useEffect(() => {
    if (!formData.startDate) {
      const currentYear = new Date().getFullYear();
      const defaultStartDate = `${currentYear}-01-01`;
      onInputChange('startDate', defaultStartDate);
    }
  }, []);

  // Update end date when tenor changes
  const handleTenorChange = (field: 'value' | 'unit', value: number | string) => {
    const currentTenor = formData.tenor || { value: 1, unit: 'years' };
    const newTenor = { ...currentTenor, [field]: field === 'value' ? Number(value) : value };
    
    onInputChange('tenor', newTenor);
    
    if (formData.startDate && newTenor.value > 0) {
      const newEndDate = VolumeUtils.calculateEndDate(formData.startDate, newTenor);
      onInputChange('endDate', newEndDate);
    }
  };

  // Update end date when start date changes
  const handleStartDateChange = (startDate: string) => {
    onInputChange('startDate', startDate);
    
    if (formData.tenor && formData.tenor.value > 0) {
      const newEndDate = VolumeUtils.calculateEndDate(startDate, formData.tenor);
      onInputChange('endDate', newEndDate);
    }
  };

  // Handle CSV volume data upload
  const handleVolumeDataUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setVolumeDataFile(file);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].toLowerCase().split(',');
      
      // Find period and volume columns
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
        
        // Parse period - support various formats
        let period = '';
        if (periodStr.match(/^\d{4}-\d{2}$/)) {
          // Already in YYYY-MM format
          period = periodStr;
        } else if (periodStr.match(/^\d{1,2}\/\d{4}$/)) {
          // MM/YYYY format
          const [month, year] = periodStr.split('/');
          period = `${year}-${month.padStart(2, '0')}`;
        } else if (periodStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // YYYY-MM-DD format - extract YYYY-MM
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

      // Calculate totals and metadata
      const totalVolume = VolumeUtils.calculateTotalVolume(timeSeriesData);
      const yearsCovered = VolumeUtils.getYearsCovered(timeSeriesData);

      setVolumeDataPreview(timeSeriesData.slice(0, 12)); // Show first 12 for preview

      // Update form data
      onInputChange('timeSeriesData', timeSeriesData);
      onInputChange('totalVolume', totalVolume);
      onInputChange('yearsCovered', yearsCovered);
      onInputChange('dataSource', 'csv_import');
      onInputChange('annualVolume', totalVolume); // Update annual volume to match total

    } catch (error) {
      console.error('Error parsing volume file:', error);
      alert('Error parsing volume file. Please ensure it\'s a valid CSV with period and volume columns.');
    }
  };

  // Get categories based on contract type
  const getAvailableCategories = (contractType: string) => {
    if (settings?.contractTypes) {
      return settings.contractTypes[contractType as keyof typeof settings.contractTypes] || [];
    }
    return [];
  };

  // Check if we should show percentage-based volume preview
  const showPercentagePreview = !VolumeUtils.hasMonthlyData(formData);

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

                {/* Tenor Input - NEW */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contract Tenor *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={formData.tenor?.value || 1}
                      onChange={(e) => handleTenorChange('value', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="50"
                    />
                    <select
                      value={formData.tenor?.unit || 'years'}
                      onChange={(e) => handleTenorChange('unit', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="months">Months</option>
                      <option value="years">Years</option>
                    </select>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    End date will be calculated and rounded to month end
                  </p>
                </div>

                {/* End Date (calculated) */}
                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
                    End Date (Calculated)
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                  />
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

              {/* Volume Data Section - ENHANCED */}
              <div className="border-t border-gray-200 pt-6 mb-6">
                <h4 className="text-md font-semibold text-gray-800 mb-4">📊 Volume Data</h4>
                
                {/* Volume Data Source Selection */}
                <div className="mb-4">
                  <div className="flex gap-4 mb-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="volumeSource"
                        checked={!VolumeUtils.hasMonthlyData(formData)}
                        onChange={() => {
                          onInputChange('timeSeriesData', undefined);
                          onInputChange('dataSource', 'manual');
                        }}
                        className="mr-2"
                      />
                      Use Volume Shape (Percentage)
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="volumeSource"
                        checked={VolumeUtils.hasMonthlyData(formData)}
                        onChange={() => setShowVolumeEditor(true)}
                        className="mr-2"
                      />
                      Use Monthly Volume Data
                    </label>
                  </div>
                </div>

                {/* Annual Volume (for percentage-based) */}
                {!VolumeUtils.hasMonthlyData(formData) && (
                  <div className="mb-4">
                    <label htmlFor="annualVolume" className="block text-sm font-medium text-gray-700 mb-2">
                      Annual Volume (MWh) *
                    </label>
                    <input
                      id="annualVolume"
                      type="number"
                      value={formData.annualVolume || ''}
                      onChange={(e) => onInputChange('annualVolume', parseFloat(e.target.value) || 0)}
                      className={`w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.annualVolume ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                      }`}
                      placeholder="Enter annual volume in MWh"
                      min="0"
                      step="1000"
                    />
                    {errors.annualVolume && <p className="mt-1 text-sm text-red-600">{errors.annualVolume}</p>}
                    
                    {/* Volume Shape */}
                    <div className="mt-4">
                      <label htmlFor="volumeShape" className="block text-sm font-medium text-gray-700 mb-2">
                        Volume Shape
                      </label>
                      <select
                        id="volumeShape"
                        value={formData.volumeShape}
                        onChange={(e) => onInputChange('volumeShape', e.target.value as Contract['volumeShape'])}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400"
                      >
                        <option value="flat">Flat</option>
                        <option value="solar">Solar</option>
                        <option value="wind">Wind</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Monthly Volume Data Upload/Input */}
                {VolumeUtils.hasMonthlyData(formData) && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload Monthly Volume Data (CSV)
                      </label>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleVolumeDataUpload}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        CSV format: Period (YYYY-MM), Volume(MWh). First row should be headers.
                      </p>
                    </div>

                    {formData.timeSeriesData && formData.timeSeriesData.length > 0 && (
                      <div className="bg-green-50 rounded-lg p-4">
                        <h5 className="font-medium text-green-800 mb-2">✅ Monthly Volume Data Loaded</h5>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-green-600">Data Points:</span>
                            <span className="ml-2 font-medium">{formData.timeSeriesData.length}</span>
                          </div>
                          <div>
                            <span className="text-green-600">Total Volume:</span>
                            <span className="ml-2 font-medium">{formData.totalVolume?.toLocaleString() || 0} MWh</span>
                          </div>
                          <div>
                            <span className="text-green-600">Years Covered:</span>
                            <span className="ml-2 font-medium">{formData.yearsCovered?.join(', ') || 'None'}</span>
                          </div>
                        </div>
                        
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => setShowVolumeEditor(!showVolumeEditor)}
                            className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
                          >
                            {showVolumeEditor ? 'Hide' : 'Show'} Volume Editor
                          </button>
                        </div>

                        {showVolumeEditor && (
                          <div className="mt-4 max-h-60 overflow-y-auto">
                            <div className="text-xs font-medium text-green-700 mb-2">Monthly Volume Data:</div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {formData.timeSeriesData.map((data, index) => (
                                <div key={index} className="bg-white border border-green-200 rounded p-2">
                                  <div className="text-xs text-green-600">{data.period}</div>
                                  <div className="font-medium text-sm">{data.volume.toFixed(0)} MWh</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pricing Section */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-md font-semibold text-gray-800 mb-4">💰 Pricing</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Strike Price */}
                  <div>
                    <label htmlFor="strikePrice" className="block text-sm font-medium text-gray-700 mb-2">
                      Strike Price ($/MWh) *
                    </label>
                    <input
                      id="strikePrice"
                      type="number"
                      value={formData.strikePrice || ''}
                      onChange={(e) => onInputChange('strikePrice', parseFloat(e.target.value) || 0)}
                      className={`w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.strikePrice ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                      }`}
                      placeholder="Enter price"
                      min="0"
                      step="0.01"
                    />
                    {errors.strikePrice && <p className="mt-1 text-sm text-red-600">{errors.strikePrice}</p>}
                  </div>

                  {/* Indexation */}
                  <div>
                    <label htmlFor="indexation" className="block text-sm font-medium text-gray-700 mb-2">
                      Indexation
                    </label>
                    <select
                      id="indexation"
                      value={formData.indexation}
                      onChange={(e) => onInputChange('indexation', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400"
                    >
                      {settings.indexationTypes.map(indexation => (
                        <option key={indexation} value={indexation}>{indexation}</option>
                      ))}
                    </select>
                  </div>

                  {/* Reference Date */}
                  <div className="md:col-span-2">
                    <label htmlFor="referenceDate" className="block text-sm font-medium text-gray-700 mb-2">
                      Reference Date
                    </label>
                    <input
                      id="referenceDate"
                      type="date"
                      value={formData.referenceDate}
                      onChange={(e) => onInputChange('referenceDate', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Panel */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Contract Preview</h3>
              
              {(formData.annualVolume > 0 || formData.timeSeriesData?.length) && formData.strikePrice > 0 ? (
                <div className="space-y-6">
                  
                  {/* Contract Summary */}
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
                      <span className="text-gray-600 font-medium">Volume Data Source:</span>
                      <span className="text-gray-900 font-semibold">
                        {VolumeUtils.hasMonthlyData(formData) ? 'Monthly Time Series' : 'Percentage Shape'}
                      </span>
                    </div>
                    {VolumeUtils.hasMonthlyData(formData) ? (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 font-medium">Total Volume:</span>
                          <span className="text-gray-900 font-semibold">
                            {formData.totalVolume?.toLocaleString()} MWh
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 font-medium">Monthly Data Points:</span>
                          <span className="text-gray-900 font-semibold">
                            {formData.timeSeriesData?.length} periods
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 font-medium">Annual Volume:</span>
                          <span className="text-gray-900 font-semibold">
                            {formData.annualVolume?.toLocaleString()} MWh
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 font-medium">Volume Shape:</span>
                          <span className="text-gray-900 font-semibold capitalize">{formData.volumeShape}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Strike Price:</span>
                      <span className="text-gray-900 font-semibold">${formData.strikePrice}/MWh</span>
                    </div>
                  </div>

                  {/* Volume Preview */}
                  {showPercentagePreview && formData.annualVolume > 0 && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-800 mb-4">📈 Monthly Volume Distribution (Percentage-Based)</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {months.map((month, index) => {
                          const monthlyVolumes = VolumeUtils.calculateFromPercentages(formData);
                          const monthlyVolume = monthlyVolumes[index];
                          const percentage = volumeShapes[formData.volumeShape]?.[index] || 8.33;
                          
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
                  )}

                  {/* Monthly Time Series Preview */}
                  {VolumeUtils.hasMonthlyData(formData) && volumeDataPreview.length > 0 && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-800 mb-4">📈 Monthly Volume Time Series (Preview)</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {volumeDataPreview.map((data, index) => (
                          <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 text-center hover:bg-gray-50 transition-colors">
                            <div className="font-semibold text-gray-800 text-sm">{data.period}</div>
                            <div className="text-green-600 font-medium text-sm">{data.volume.toFixed(0)} MWh</div>
                          </div>
                        ))}
                      </div>
                      {formData.timeSeriesData && formData.timeSeriesData.length > 12 && (
                        <p className="text-center text-gray-500 text-sm mt-3">
                          ... and {formData.timeSeriesData.length - 12} more periods
                        </p>
                      )}
                    </div>
                  )}

                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p>Enter contract details to see the preview</p>
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-4 pt-6 border-t border-gray-200 mt-8">
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
      </div>
    </div>
  );
}