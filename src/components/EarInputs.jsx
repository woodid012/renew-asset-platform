// EarInputs.jsx - Updated EaR Inputs Component
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { validateTimePeriods } from './EarCalculations';

// Component for parameter input fields
const ParameterInput = ({ label, value, onChange, min = 0, error }) => (
  <div>
    <label className="text-sm text-gray-500 block">
      {label}
    </label>
    <Input
      type="number"
      value={value}
      min={min}
      onChange={(e) => onChange(parseInt(e.target.value) || 0)}
      className={`h-8 w-24 ${error ? 'border-red-500' : ''}`}
    />
  </div>
);

// TimePeriod Parameters Component
const TimePeriodParameters = ({ 
  period, 
  onUpdate, 
  onRemove, 
  canRemove,
  error
}) => (
  <div className={`flex items-start gap-4 p-3 rounded ${error ? 'bg-red-50' : 'bg-gray-50'}`}>
    <div className="flex gap-4">
      <div>
        <label className="text-sm text-gray-500 block">Years</label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={period.startYear}
            onChange={(e) => onUpdate({ ...period, startYear: parseInt(e.target.value) || 0 })}
            className={`h-8 w-20 ${error ? 'border-red-500' : ''}`}
          />
          <span>-</span>
          <Input
            type="number"
            value={period.endYear}
            onChange={(e) => onUpdate({ ...period, endYear: parseInt(e.target.value) || 0 })}
            className={`h-8 w-20 ${error ? 'border-red-500' : ''}`}
          />
        </div>
      </div>
      <ParameterInput
        label="Volume Sensitivity (±%)"
        value={period.volumeVariation}
        onChange={(value) => onUpdate({ ...period, volumeVariation: value })}
      />
      <ParameterInput
        label="Energy Price Sensitivity (±%)"
        value={period.EnergyPriceVariation}
        onChange={(value) => onUpdate({ ...period, EnergyPriceVariation: value })}
      />
      <ParameterInput
        label="Green Price Sensitivity (±%)"
        value={period.greenPriceVariation}
        onChange={(value) => onUpdate({ ...period, greenPriceVariation: value })}
      />
    </div>
    {canRemove && (
      <button
        onClick={onRemove}
        className="text-red-500 hover:text-red-700 p-1"
        aria-label="Remove time period"
      >
        ✕
      </button>
    )}
  </div>
);

// Main EarInputs Component
const EarInputs = ({ constants, updateConstants, onTimePeriodsChange, mode, setMode, timePeriods: externalTimePeriods }) => {
  const [validationError, setValidationError] = useState(null);
  const [initializedVariations] = useState({
    volumeVariation: constants.volumeVariation,
    EnergyPriceVariation: constants.EnergyPriceVariation,
    greenPriceVariation: constants.greenPriceVariation
  });

  // Initialize time periods if none are provided
  useEffect(() => {
    if (mode === 'complex' && !externalTimePeriods) {
      const midYear = Math.floor((constants.analysisEndYear - constants.analysisStartYear) / 2) + constants.analysisStartYear;
      const defaultPeriods = [
        {
          startYear: constants.analysisStartYear,
          endYear: midYear,
          volumeVariation: initializedVariations.volumeVariation,
          EnergyPriceVariation: initializedVariations.EnergyPriceVariation,
          greenPriceVariation: initializedVariations.greenPriceVariation,
        },
        {
          startYear: midYear + 1,
          endYear: constants.analysisEndYear,
          volumeVariation: initializedVariations.volumeVariation,
          EnergyPriceVariation: initializedVariations.EnergyPriceVariation,
          greenPriceVariation: initializedVariations.greenPriceVariation,
        }
      ];
      onTimePeriodsChange(defaultPeriods);
    }
  }, [mode, externalTimePeriods, constants.analysisStartYear, constants.analysisEndYear, initializedVariations, onTimePeriodsChange]);

  // Validate time periods and update parent
  useEffect(() => {
    if (mode === 'complex' && externalTimePeriods) {
      const validation = validateTimePeriods(
        externalTimePeriods, 
        constants.analysisStartYear, 
        constants.analysisEndYear
      );
      
      setValidationError(validation.error);
      
      if (!validation.valid) {
        onTimePeriodsChange(null);
      }
    } else {
      setValidationError(null);
      onTimePeriodsChange(null);
    }
  }, [mode, externalTimePeriods, constants.analysisStartYear, constants.analysisEndYear, onTimePeriodsChange]);

  const handleAddPeriod = () => {
    if (!externalTimePeriods || externalTimePeriods.length >= 5) return;
    
    const lastPeriod = externalTimePeriods[externalTimePeriods.length - 1];
    const newEndYear = Math.min(
      lastPeriod.endYear + Math.floor((constants.analysisEndYear - lastPeriod.endYear) / 2),
      constants.analysisEndYear
    );
    
    onTimePeriodsChange([
      ...externalTimePeriods,
      {
        startYear: lastPeriod.endYear + 1,
        endYear: newEndYear,
        volumeVariation: initializedVariations.volumeVariation,
        EnergyPriceVariation: initializedVariations.EnergyPriceVariation,
        greenPriceVariation: initializedVariations.greenPriceVariation,
      }
    ]);
  };

  const handleRemovePeriod = (index) => {
    if (!externalTimePeriods || externalTimePeriods.length <= 1) return;
    onTimePeriodsChange(externalTimePeriods.filter((_, i) => i !== index));
  };

  const handleUpdatePeriod = (index, updatedPeriod) => {
    if (!externalTimePeriods) return;
    const newPeriods = [...externalTimePeriods];
    newPeriods[index] = updatedPeriod;
    onTimePeriodsChange(newPeriods);
  };

  const handleSimpleParameterChange = (key, value) => {
    // Update both initialized variations and constants
    initializedVariations[key] = value;
    updateConstants(key, value);

    // If in complex mode, update all time periods with the new value
    if (mode === 'complex' && externalTimePeriods) {
      const updatedPeriods = externalTimePeriods.map(period => ({
        ...period,
        [key]: value
      }));
      onTimePeriodsChange(updatedPeriods);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Analysis Input Parameters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-500">Mode:</label>
            <select
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="simple">Simple</option>
              <option value="complex">Complex</option>
            </select>
          </div>

          {mode === 'simple' ? (
            <div className="flex justify-between items-start gap-6">
              <div className="flex gap-6">
                <ParameterInput
                  label="Volume Sensitivity (±%)"
                  value={initializedVariations.volumeVariation}
                  onChange={(value) => handleSimpleParameterChange('volumeVariation', value)}
                />
                <ParameterInput
                  label="Energy Price Sensitivity (±%)"
                  value={initializedVariations.EnergyPriceVariation}
                  onChange={(value) => handleSimpleParameterChange('EnergyPriceVariation', value)}
                />
                <ParameterInput
                  label="Green Price Sensitivity (±%)"
                  value={initializedVariations.greenPriceVariation}
                  onChange={(value) => handleSimpleParameterChange('greenPriceVariation', value)}
                />
              </div>
              <ul className="text-xs space-y-1 text-gray-600 min-w-64">
                <li>• Merchant revenue affected by both volume and price risks</li>
                <li>• Green and Energy prices vary independently</li>
                <li>• PPA revenue affected by volume risk only</li>
              </ul>
            </div>
          ) : (
            <div className="space-y-3">
              {externalTimePeriods?.map((period, index) => (
                <TimePeriodParameters
                  key={index}
                  period={period}
                  onUpdate={(updatedPeriod) => handleUpdatePeriod(index, updatedPeriod)}
                  onRemove={() => handleRemovePeriod(index)}
                  canRemove={externalTimePeriods.length > 1}
                  error={validationError}
                />
              ))}
              {externalTimePeriods && externalTimePeriods.length < 5 && (
                <button
                  onClick={handleAddPeriod}
                  className="text-sm text-blue-500 hover:text-blue-700"
                >
                  + Add Time Period
                </button>
              )}
              {validationError && (
                <div className="text-sm text-red-500 mt-2">
                  {validationError}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EarInputs;