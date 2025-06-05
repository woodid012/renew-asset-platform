'use client';

import { useState, useEffect } from 'react';

interface TimeBasedPricingPeriod {
  id: string;
  name: string;
  price: number;
  startTime: string;
  endTime: string;
  daysOfWeek: boolean[]; // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
}

interface CustomVolumeData {
  interval: 'hourly' | 'daily' | 'monthly';
  data: number[];
  startDate: string;
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
  timeBasedPricing?: {
    periods: TimeBasedPricingPeriod[];
    defaultPrice: number;
  };
  customVolumeData?: CustomVolumeData;
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

interface ContractInputsProps {
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

const defaultCategories = {
  retail: ['Retail Customer', 'Industrial Customer', 'Government Customer', 'Small Business', 'Residential'],
  wholesale: ['Swap', 'Cap', 'Floor', 'Forward', 'Option'],
  offtake: ['Solar Farm', 'Wind Farm', 'Battery Storage', 'Hydro', 'Gas Peaker']
};

export default function ContractInputs({
  formData,
  isEditing,
  errors,
  settings,
  volumeShapes,
  onInputChange,
  onSave,
  onCancel,
  isSaving,
}: ContractInputsProps) {
  const [customVolumeFile, setCustomVolumeFile] = useState<File | null>(null);
  const [volumeDataPreview, setVolumeDataPreview] = useState<number[]>([]);

  if (!formData) return null;

  // Generate time series prices based on interval
  const generateTimeSeries = () => {
    const periods = getNumberOfPeriods();
    const basePrice = formData.strikePrice || 0;
    const escalationRate = (formData.escalationRate || 0) / 100;
    
    const prices: number[] = [];
    for (let i = 0; i < periods; i++) {
      let periodPrice = basePrice;
      if (formData.pricingType === 'escalation') {
        const yearsElapsed = formData.priceInterval === 'monthly' ? i / 12 : 
                            formData.priceInterval === 'quarterly' ? i / 4 : i;
        periodPrice = basePrice * Math.pow(1 + escalationRate, yearsElapsed);
      }
      prices.push(Math.round(periodPrice * 100) / 100);
    }
    return prices;
  };

  // Calculate contract length in years
  const getContractLength = () => {
    if (!formData.startDate || !formData.endDate) return 0;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
    return Math.round(diffYears * 10) / 10;
  };

  // Calculate number of periods based on contract length and interval
  const getNumberOfPeriods = () => {
    const contractLength = getContractLength();
    if (!contractLength || !formData.priceInterval) return 0;
    
    switch (formData.priceInterval) {
      case 'monthly': return Math.ceil(contractLength * 12);
      case 'quarterly': return Math.ceil(contractLength * 4);
      case 'yearly': return Math.ceil(contractLength);
      default: return 0;
    }
  };

  // Update time series when relevant fields change
  useEffect(() => {
    if (formData && (formData.pricingType === 'escalation' || formData.pricingType === 'timeseries')) {
      const newTimeSeries = generateTimeSeries();
      onInputChange('priceTimeSeries', newTimeSeries);
    }
  }, [formData.startDate, formData.endDate, formData.strikePrice, formData.escalationRate, formData.priceInterval, formData.pricingType]);

  // Get categories based on contract type
  const getAvailableCategories = (contractType: string) => {
    if (settings?.contractTypes) {
      return settings.contractTypes[contractType as keyof typeof settings.contractTypes] || [];
    }
    return defaultCategories[contractType as keyof typeof defaultCategories] || [];
  };

  // Get volume unit label based on contract type
  const getVolumeUnitLabel = () => {
    return formData.type === 'wholesale' ? 'Annual Volume (MW)' : 'Annual Volume (MWh)';
  };

  // Convert MW to MWh for wholesale contracts
  const getAnnualMWh = () => {
    if (formData.type === 'wholesale') {
      return formData.annualVolume * 8760;
    }
    return formData.annualVolume || 0;
  };

  // Handle time-based pricing period changes
  const addTimeBasedPeriod = () => {
    const newPeriod: TimeBasedPricingPeriod = {
      id: Date.now().toString(),
      name: `Period ${(formData.timeBasedPricing?.periods.length || 0) + 1}`,
      price: formData.strikePrice || 0,
      startTime: '07:00',
      endTime: '22:00',
      daysOfWeek: [true, true, true, true, true, false, false] // Mon-Fri default
    };

    const currentPricing = formData.timeBasedPricing || { periods: [], defaultPrice: formData.strikePrice || 0 };
    const updatedPricing = {
      ...currentPricing,
      periods: [...currentPricing.periods, newPeriod]
    };

    onInputChange('timeBasedPricing', updatedPricing);
  };

  const updateTimeBasedPeriod = (periodId: string, field: keyof TimeBasedPricingPeriod, value: any) => {
    if (!formData.timeBasedPricing) return;

    const updatedPeriods = formData.timeBasedPricing.periods.map(period =>
      period.id === periodId ? { ...period, [field]: value } : period
    );

    const updatedPricing = {
      ...formData.timeBasedPricing,
      periods: updatedPeriods
    };

    onInputChange('timeBasedPricing', updatedPricing);
  };

  const removeTimeBasedPeriod = (periodId: string) => {
    if (!formData.timeBasedPricing) return;

    const updatedPeriods = formData.timeBasedPricing.periods.filter(period => period.id !== periodId);
    const updatedPricing = {
      ...formData.timeBasedPricing,
      periods: updatedPeriods
    };

    onInputChange('timeBasedPricing', updatedPricing);
  };

  const updateDayOfWeek = (periodId: string, dayIndex: number, checked: boolean) => {
    if (!formData.timeBasedPricing) return;

    const updatedPeriods = formData.timeBasedPricing.periods.map(period => {
      if (period.id === periodId) {
        const newDaysOfWeek = [...period.daysOfWeek];
        newDaysOfWeek[dayIndex] = checked;
        return { ...period, daysOfWeek: newDaysOfWeek };
      }
      return period;
    });

    const updatedPricing = {
      ...formData.timeBasedPricing,
      periods: updatedPeriods
    };

    onInputChange('timeBasedPricing', updatedPricing);
  };

  // Handle custom volume data upload
  const handleVolumeFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCustomVolumeFile(file);

    // Parse CSV file
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const values = lines.slice(1).map(line => {
        const cells = line.split(',');
        return parseFloat(cells[1]) || 0; // Assuming second column is volume
      });

      setVolumeDataPreview(values.slice(0, 12)); // Show first 12 values

      const customVolumeData: CustomVolumeData = {
        interval: 'monthly', // Default, user can change
        data: values,
        startDate: formData.startDate
      };

      onInputChange('customVolumeData', customVolumeData);
    } catch (error) {
      console.error('Error parsing volume file:', error);
      alert('Error parsing volume file. Please ensure it\'s a valid CSV with volume data in the second column.');
    }
  };

  // Handle price time series change
  const handlePriceTimeSeriesChange = (index: number, value: number) => {
    if (!formData.priceTimeSeries) return;
    const newTimeSeries = [...formData.priceTimeSeries];
    newTimeSeries[index] = value;
    onInputChange('priceTimeSeries', newTimeSeries);
  };

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

  const unitTypes = (settings?.unitTypes || ['Energy', 'Green']).map(unit => ({
    value: unit,
    label: unit
  }));

  const productDetails = [
    { value: 'CY', label: 'Calendar Year' },
    { value: 'FY', label: 'Financial Year' },
    { value: 'Q1', label: 'Q1' },
    { value: 'Q2', label: 'Q2' },
    { value: 'Q3', label: 'Q3' },
    { value: 'Q4', label: 'Q4' }
  ];

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

                {/* Product Detail (for wholesale) */}
                {formData.type === 'wholesale' && (
                  <div>
                    <label htmlFor="productDetail" className="block text-sm font-medium text-gray-700 mb-2">
                      Product Detail
                    </label>
                    <select
                      id="productDetail"
                      value={formData.productDetail || 'CY'}
                      onChange={(e) => onInputChange('productDetail', e.target.value as Contract['productDetail'])}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400"
                    >
                      {productDetails.map(detail => (
                        <option key={detail.value} value={detail.value}>{detail.label}</option>
                      ))}
                    </select>
                  </div>
                )}

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
                    onChange={(e) => onInputChange('startDate', e.target.value)}
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
                    onChange={(e) => onInputChange('endDate', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.endDate ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  />
                  {errors.endDate && <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>}
                </div>

                {/* Annual Volume */}
                <div>
                  <label htmlFor="annualVolume" className="block text-sm font-medium text-gray-700 mb-2">
                    {getVolumeUnitLabel()} *
                  </label>
                  <input
                    id="annualVolume"
                    type="number"
                    value={formData.annualVolume || ''}
                    onChange={(e) => onInputChange('annualVolume', parseFloat(e.target.value) || 0)}
                    className={`w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.annualVolume ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                    placeholder={`Enter annual volume in ${formData.type === 'wholesale' ? 'MW' : 'MWh'}`}
                    min="0"
                    step="1000"
                  />
                  {errors.annualVolume && <p className="mt-1 text-sm text-red-600">{errors.annualVolume}</p>}
                </div>

                {/* Unit */}
                <div>
                  <label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-2">
                    Unit
                  </label>
                  <select
                    id="unit"
                    value={formData.unit}
                    onChange={(e) => onInputChange('unit', e.target.value)}
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
                    onChange={(e) => onInputChange('volumeShape', e.target.value as Contract['volumeShape'])}
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
                    onChange={(e) => onInputChange('status', e.target.value as Contract['status'])}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400"
                  >
                    {statuses.map(status => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Volume Data Upload */}
              <div className="border-t border-gray-200 pt-6 mb-6">
                <h4 className="text-md font-semibold text-gray-800 mb-4">📊 Custom Volume Data (Optional)</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Volume Time Series (CSV)
                    </label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleVolumeFileUpload}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      CSV format: Date, Volume(MWh), ... First row should be headers.
                    </p>
                  </div>

                  {formData.customVolumeData && (
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h5 className="font-medium text-blue-800 mb-2">Custom Volume Data Loaded</h5>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-blue-600">Data Points:</span>
                          <span className="ml-2 font-medium">{formData.customVolumeData.data.length}</span>
                        </div>
                        <div>
                          <span className="text-blue-600">Interval:</span>
                          <span className="ml-2 font-medium capitalize">{formData.customVolumeData.interval}</span>
                        </div>
                      </div>
                      {volumeDataPreview.length > 0 && (
                        <div className="mt-2">
                          <span className="text-blue-600 text-xs">Preview (first 12 values):</span>
                          <div className="grid grid-cols-6 gap-1 mt-1">
                            {volumeDataPreview.map((value, index) => (
                              <div key={index} className="text-xs bg-white px-2 py-1 rounded">
                                {value.toFixed(0)} MWh
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing Section */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-md font-semibold text-gray-800 mb-4">💰 Pricing & Indexation</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Pricing Type */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pricing Type *
                    </label>
                    <div className="flex gap-4 flex-wrap">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="pricingType"
                          value="fixed"
                          checked={formData.pricingType === 'fixed'}
                          onChange={(e) => onInputChange('pricingType', e.target.value)}
                          className="mr-2"
                        />
                        Fixed Price
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="pricingType"
                          value="escalation"
                          checked={formData.pricingType === 'escalation'}
                          onChange={(e) => onInputChange('pricingType', e.target.value)}
                          className="mr-2"
                        />
                        Escalation
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="pricingType"
                          value="timeseries"
                          checked={formData.pricingType === 'timeseries'}
                          onChange={(e) => onInputChange('pricingType', e.target.value)}
                          className="mr-2"
                        />
                        Time Series
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="pricingType"
                          value="custom_time_of_day"
                          checked={formData.pricingType === 'custom_time_of_day'}
                          onChange={(e) => onInputChange('pricingType', e.target.value)}
                          className="mr-2"
                        />
                        Time-of-Day
                      </label>
                    </div>
                  </div>

                  {/* Strike Price */}
                  <div>
                    <label htmlFor="strikePrice" className="block text-sm font-medium text-gray-700 mb-2">
                      {formData.pricingType === 'fixed' ? 'Strike Price ($/MWh)' : 
                       formData.pricingType === 'custom_time_of_day' ? 'Default Price ($/MWh)' : 
                       'Base Price ($/MWh)'} *
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

                  {/* Escalation Rate (if escalation selected) */}
                  {formData.pricingType === 'escalation' && (
                    <div>
                      <label htmlFor="escalationRate" className="block text-sm font-medium text-gray-700 mb-2">
                        Escalation Rate (% per year) *
                      </label>
                      <input
                        id="escalationRate"
                        type="number"
                        value={formData.escalationRate || ''}
                        onChange={(e) => onInputChange('escalationRate', parseFloat(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400"
                        placeholder="Enter escalation rate"
                        min="0"
                        step="0.1"
                      />
                    </div>
                  )}

                  {/* Price Interval (if escalation or timeseries) */}
                  {(formData.pricingType === 'escalation' || formData.pricingType === 'timeseries') && (
                    <div>
                      <label htmlFor="priceInterval" className="block text-sm font-medium text-gray-700 mb-2">
                        Price Interval
                      </label>
                      <select
                        id="priceInterval"
                        value={formData.priceInterval}
                        onChange={(e) => onInputChange('priceInterval', e.target.value as Contract['priceInterval'])}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                  )}

                  {/* Reference Date */}
                  <div className={formData.pricingType === 'escalation' ? 'md:col-span-2' : ''}>
                    <label htmlFor="referenceDate" className="block text-sm font-medium text-gray-700 mb-2">
                      Reference Date {formData.pricingType === 'escalation' ? '*' : ''}
                    </label>
                    <input
                      id="referenceDate"
                      type="date"
                      value={formData.referenceDate}
                      onChange={(e) => onInputChange('referenceDate', e.target.value)}
                      className={`w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.referenceDate ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                      }`}
                    />
                    {errors.referenceDate && <p className="mt-1 text-sm text-red-600">{errors.referenceDate}</p>}
                  </div>
                </div>

                {/* Time-of-Day Pricing */}
                {formData.pricingType === 'custom_time_of_day' && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                      <h5 className="font-medium text-gray-800">⏰ Time-of-Day Pricing Periods</h5>
                      <button
                        type="button"
                        onClick={addTimeBasedPeriod}
                        className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors"
                      >
                        + Add Period
                      </button>
                    </div>

                    {formData.timeBasedPricing && formData.timeBasedPricing.periods.length > 0 ? (
                      <div className="space-y-4">
                        {formData.timeBasedPricing.periods.map((period) => (
                          <div key={period.id} className="bg-white p-4 rounded border">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Period Name</label>
                                <input
                                  type="text"
                                  value={period.name}
                                  onChange={(e) => updateTimeBasedPeriod(period.id, 'name', e.target.value)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Price ($/MWh)</label>
                                <input
                                  type="number"
                                  value={period.price}
                                  onChange={(e) => updateTimeBasedPeriod(period.id, 'price', parseFloat(e.target.value) || 0)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  step="0.01"
                                  min="0"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
                                <input
                                  type="time"
                                  value={period.startTime}
                                  onChange={(e) => updateTimeBasedPeriod(period.id, 'startTime', e.target.value)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
                                <input
                                  type="time"
                                  value={period.endTime}
                                  onChange={(e) => updateTimeBasedPeriod(period.id, 'endTime', e.target.value)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                            
                            <div className="mb-3">
                              <label className="block text-xs font-medium text-gray-600 mb-2">Days of Week</label>
                              <div className="flex gap-2">
                                {dayNames.map((day, index) => (
                                  <label key={day} className="flex items-center">
                                    <input
                                      type="checkbox"
                                      checked={period.daysOfWeek[index]}
                                      onChange={(e) => updateDayOfWeek(period.id, index, e.target.checked)}
                                      className="mr-1"
                                    />
                                    <span className="text-xs">{day}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => removeTimeBasedPeriod(period.id)}
                                className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        No pricing periods defined. Click "Add Period" to create time-based pricing rules.
                      </div>
                    )}

                    {formData.timeBasedPricing && (
                      <div className="mt-4 p-3 bg-blue-50 rounded">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Default Price ($/MWh) - for times not covered by periods above
                        </label>
                        <input
                          type="number"
                          value={formData.timeBasedPricing.defaultPrice}
                          onChange={(e) => {
                            const updatedPricing = {
                              ...formData.timeBasedPricing!,
                              defaultPrice: parseFloat(e.target.value) || 0
                            };
                            onInputChange('timeBasedPricing', updatedPricing);
                          }}
                          className="w-32 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          step="0.01"
                          min="0"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Preview Panel */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Contract Preview</h3>
              
              {formData.annualVolume > 0 || formData.strikePrice > 0 ? (
                <div className="space-y-6">
                  {/* Contract Summary */}
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Contract Length:</span>
                      <span className="text-gray-900 font-semibold">{getContractLength()} years</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Annual Volume:</span>
                      <span className="text-gray-900 font-semibold">
                        {formData.type === 'wholesale' 
                          ? `${formData.annualVolume.toLocaleString()} MW (${getAnnualMWh().toLocaleString()} MWh)`
                          : `${formData.annualVolume.toLocaleString()} MWh`
                        }
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Volume Shape:</span>
                      <span className="text-gray-900 font-semibold capitalize">{formData.volumeShape}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Unit:</span>
                      <span className="text-gray-900 font-semibold">{formData.unit}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Pricing Type:</span>
                      <span className="text-gray-900 font-semibold capitalize">
                        {formData.pricingType === 'custom_time_of_day' ? 'Time-of-Day' : formData.pricingType}
                      </span>
                    </div>
                    {formData.pricingType === 'escalation' && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 font-medium">Escalation Rate:</span>
                        <span className="text-gray-900 font-semibold">{formData.escalationRate}% per year</span>
                      </div>
                    )}
                    {formData.customVolumeData && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 font-medium">Custom Volume Data:</span>
                        <span className="text-gray-900 font-semibold">
                          {formData.customVolumeData.data.length} {formData.customVolumeData.interval} points
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Volume Distribution */}
                  {formData.annualVolume > 0 && !formData.customVolumeData && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-800 mb-4">📈 Monthly Volume Distribution</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {months.map((month, index) => {
                          const volumeProfile = volumeShapes[formData.volumeShape] || volumeShapes.flat;
                          const annualMWh = getAnnualMWh();
                          const monthlyVolume = annualMWh * volumeProfile[index] / 100;
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
                  )}

                  {/* Time-of-Day Pricing Preview */}
                  {formData.pricingType === 'custom_time_of_day' && formData.timeBasedPricing && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-800 mb-4">⏰ Time-of-Day Pricing Summary</h4>
                      <div className="space-y-2">
                        {formData.timeBasedPricing.periods.map((period) => (
                          <div key={period.id} className="bg-white border border-gray-200 rounded p-3">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-medium text-sm">{period.name}</span>
                              <span className="font-semibold text-blue-600">${period.price.toFixed(2)}/MWh</span>
                            </div>
                            <div className="text-xs text-gray-600">
                              {period.startTime} - {period.endTime} • {dayNames.filter((_, i) => period.daysOfWeek[i]).join(', ')}
                            </div>
                          </div>
                        ))}
                        <div className="bg-gray-100 border border-gray-200 rounded p-3">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-sm">Default (other times)</span>
                            <span className="font-semibold text-gray-600">${formData.timeBasedPricing.defaultPrice.toFixed(2)}/MWh</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Price Schedule */}
                  {formData.pricingType !== 'fixed' && formData.pricingType !== 'custom_time_of_day' && 
                   formData.priceTimeSeries && formData.priceTimeSeries.length > 0 && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-800 mb-4">💵 Price Schedule</h4>
                      <div className="max-h-60 overflow-y-auto">
                        {formData.pricingType === 'timeseries' ? (
                          <div className="grid grid-cols-1 gap-2">
                            {formData.priceTimeSeries.map((price, index) => (
                              <div key={index} className="flex items-center gap-3 bg-white border border-gray-200 rounded p-3">
                                <span className="text-sm font-medium text-gray-600 w-20">
                                  {formData.priceInterval === 'monthly' ? `Month ${index + 1}` :
                                   formData.priceInterval === 'quarterly' ? `Q${index + 1}` :
                                   `Year ${index + 1}`}:
                                </span>
                                <input
                                  type="number"
                                  value={price}
                                  onChange={(e) => handlePriceTimeSeriesChange(index, parseFloat(e.target.value) || 0)}
                                  className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  step="0.01"
                                  min="0"
                                />
                                <span className="text-sm text-gray-500">$/MWh</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-2">
                            {formData.priceTimeSeries.map((price, index) => (
                              <div key={index} className="flex justify-between items-center bg-white border border-gray-200 rounded p-3">
                                <span className="text-sm font-medium text-gray-600">
                                  {formData.priceInterval === 'monthly' ? `Month ${index + 1}` :
                                   formData.priceInterval === 'quarterly' ? `Q${index + 1}` :
                                   `Year ${index + 1}`}:
                                </span>
                                <span className="text-sm font-semibold text-gray-900">
                                  ${price.toFixed(2)}/MWh
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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