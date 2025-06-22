// hooks/useAssetSummary.js
import { useState, useEffect, useCallback } from 'react';
import { useAssetManagement } from './useAssetManagement';
import { 
  formatNumericValue, 
  handleNumericInput,
  createNewContract
} from '@/utils/assetUtils';
import {
  DEFAULT_TAX_DEPRECIATION,
  getDefaultValue,
  UI_CONSTANTS
} from '@/lib/default_constants';

export const useAssetSummary = () => {
  const { 
    assets, 
    setAssets, 
    constants, 
    updateConstants,
    getAssetCostDefault 
  } = useAssetManagement();
  
  const [editState, setEditState] = useState({});

  // Tax and depreciation constants
  const corporateTaxRate = constants.corporateTaxRate !== undefined 
    ? constants.corporateTaxRate 
    : DEFAULT_TAX_DEPRECIATION.corporateTaxRate;
  
  const deprecationPeriods = constants.deprecationPeriods || DEFAULT_TAX_DEPRECIATION.deprecationPeriods;

  // Helper function to determine if a value is default (blue) or user-defined (black)
  const getValueStyle = useCallback((currentValue, defaultValue) => {
    const isDefault = currentValue === undefined || currentValue === null || currentValue === defaultValue;
    return isDefault ? UI_CONSTANTS.colors.defaultValue : UI_CONSTANTS.colors.userValue;
  }, []);

  // Date utilities
  const roundToFirstOfMonth = useCallback((dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    
    // Check if date is valid
    if (isNaN(date.getTime())) return '';
    
    date.setDate(1);
    
    // Check if resulting date is still valid
    if (isNaN(date.getTime())) return '';
    
    return date.toISOString().split('T')[0];
  }, []);

  const addMonthsToDate = useCallback((dateStr, months) => {
    if (!dateStr || !months) return '';
    const date = new Date(dateStr);
    
    // Check if date is valid
    if (isNaN(date.getTime())) return '';
    
    const parsedMonths = parseInt(months);
    if (isNaN(parsedMonths)) return '';
    
    date.setMonth(date.getMonth() + parsedMonths);
    date.setDate(1);
    
    // Check if resulting date is valid
    if (isNaN(date.getTime())) return '';
    
    return date.toISOString().split('T')[0];
  }, []);

  const calculateMonthsBetween = useCallback((startDateStr, endDateStr) => {
    if (!startDateStr || !endDateStr) return '';
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    
    // Check if dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return '';
    
    const yearDiff = endDate.getFullYear() - startDate.getFullYear();
    const monthDiff = endDate.getMonth() - startDate.getMonth();
    
    return yearDiff * 12 + monthDiff;
  }, []);

  // Initialize tax/depreciation values if they don't exist
  useEffect(() => {
    if (constants.corporateTaxRate === undefined) {
      updateConstants('corporateTaxRate', DEFAULT_TAX_DEPRECIATION.corporateTaxRate);
    }
    
    if (!constants.deprecationPeriods) {
      updateConstants('deprecationPeriods', DEFAULT_TAX_DEPRECIATION.deprecationPeriods);
    }
  }, [constants, updateConstants]);

  // Initialize edit state with asset values
  useEffect(() => {
    const initialState = {};
    Object.values(assets).forEach(asset => {
      initialState[asset.id] = JSON.parse(JSON.stringify(asset));
    });
    setEditState(initialState);
  }, [assets]);

  // Update a field for a specific asset
  const handleFieldUpdate = useCallback((assetId, field, value, options = {}) => {
    // Handle date fields with linked logic
    if (field === 'constructionStartDate' || field === 'assetStartDate') {
      handleDateFieldUpdate(assetId, field, value);
      return;
    }
    
    // Handle construction duration with linked logic
    if (field === 'constructionDuration') {
      handleConstructionDurationUpdate(assetId, value);
      return;
    }
    
    // For all other fields, use normal processing
    setEditState(prev => ({
      ...prev,
      [assetId]: {
        ...prev[assetId],
        [field]: handleNumericInput(value, options)
      }
    }));
  }, []);

  // Enhanced date field handler with automatic calculation
  const handleDateFieldUpdate = useCallback((assetId, field, value) => {
    const roundedValue = roundToFirstOfMonth(value);
    
    setEditState(prev => ({
      ...prev,
      [assetId]: {
        ...prev[assetId],
        [field]: roundedValue
      }
    }));
    
    const currentAsset = editState[assetId];
    if (!currentAsset) return;
    
    if (field === 'constructionStartDate' && currentAsset.constructionDuration) {
      const newOpsStart = addMonthsToDate(roundedValue, currentAsset.constructionDuration);
      if (newOpsStart !== currentAsset.assetStartDate) {
        setEditState(prev => ({
          ...prev,
          [assetId]: {
            ...prev[assetId],
            assetStartDate: newOpsStart
          }
        }));
      }
    } else if (field === 'assetStartDate' && currentAsset.constructionStartDate) {
      const newDuration = calculateMonthsBetween(currentAsset.constructionStartDate, roundedValue);
      if (newDuration !== currentAsset.constructionDuration) {
        setEditState(prev => ({
          ...prev,
          [assetId]: {
            ...prev[assetId],
            constructionDuration: newDuration
          }
        }));
      }
    }
  }, [editState, roundToFirstOfMonth, addMonthsToDate, calculateMonthsBetween]);

  // Enhanced construction duration handler
  const handleConstructionDurationUpdate = useCallback((assetId, value) => {
    const processedValue = handleNumericInput(value, { round: true });
    
    setEditState(prev => ({
      ...prev,
      [assetId]: {
        ...prev[assetId],
        constructionDuration: processedValue
      }
    }));
    
    const currentAsset = editState[assetId];
    if (!currentAsset) return;
    
    if (currentAsset.constructionStartDate && processedValue) {
      const newOpsStart = addMonthsToDate(currentAsset.constructionStartDate, processedValue);
      if (newOpsStart !== currentAsset.assetStartDate) {
        setEditState(prev => ({
          ...prev,
          [assetId]: {
            ...prev[assetId],
            assetStartDate: newOpsStart
          }
        }));
      }
    }
  }, [editState, addMonthsToDate]);

  // Save all changes
  const saveChanges = useCallback(() => {
    setAssets(editState);
  }, [editState, setAssets]);

  // Contract management
  const addContractToAll = useCallback(() => {
    const updatedAssets = {};
    
    Object.entries(assets).forEach(([id, asset]) => {
      const newContract = createNewContract(asset.contracts, asset.assetStartDate);
      updatedAssets[id] = {
        ...asset,
        contracts: [...asset.contracts, newContract]
      };
    });
    
    setAssets(updatedAssets);
  }, [assets, setAssets]);

  // Update a contract field for a specific asset
  const handleContractUpdate = useCallback((assetId, contractId, field, value, options = {}) => {
    // If it's a date field, pass the value directly
    if (field === 'startDate' || field === 'endDate') {
      setEditState(prev => ({
        ...prev,
        [assetId]: {
          ...prev[assetId],
          contracts: prev[assetId]?.contracts?.map(contract => {
            if (contract.id !== contractId) return contract;
            return {
              ...contract,
              [field]: value
            };
          }) || []
        }
      }));
      return;
    }
    
    // For non-date fields, use normal processing
    setEditState(prev => ({
      ...prev,
      [assetId]: {
        ...prev[assetId],
        contracts: prev[assetId]?.contracts?.map(contract => {
          if (contract.id !== contractId) return contract;
          return {
            ...contract,
            [field]: handleNumericInput(value, options)
          };
        }) || []
      }
    }));
  }, []);

  // Get all unique contract IDs across all assets
  const getAllContractIds = useCallback(() => {
    const contractIds = new Set();
    
    Object.values(assets).forEach(asset => {
      asset.contracts.forEach(contract => {
        contractIds.add(contract.id);
      });
    });
    
    return Array.from(contractIds).sort((a, b) => {
      return parseInt(a) - parseInt(b);
    });
  }, [assets]);

  // Tax and depreciation handlers
  const handleTaxRateChange = useCallback((value) => {
    updateConstants('corporateTaxRate', parseFloat(value) || 0);
  }, [updateConstants]);

  const handleDepreciationChange = useCallback((assetType, value) => {
    const updatedPeriods = {
      ...deprecationPeriods,
      [assetType]: parseInt(value) || 0
    };
    
    updateConstants('deprecationPeriods', updatedPeriods);
  }, [deprecationPeriods, updateConstants]);

  // Asset cost management
  const handleAssetCostChange = useCallback((assetName, field, value) => {
    const asset = Object.values(assets).find(a => a.name === assetName);
    if (!asset) return;

    // Make sure the asset costs object exists for this asset
    if (!constants.assetCosts[assetName]) {
      updateConstants('assetCosts', {
        ...constants.assetCosts,
        [assetName]: {
          capex: getAssetCostDefault('capex', asset.type, asset.capacity),
          operatingCosts: getAssetCostDefault('operatingCosts', asset.type, asset.capacity),
          operatingCostEscalation: getAssetCostDefault('operatingCostEscalation', asset.type, asset.capacity),
          terminalValue: getAssetCostDefault('terminalValue', asset.type, asset.capacity),
          maxGearing: getAssetCostDefault('maxGearing', asset.type, asset.capacity) / 100,
          targetDSCRContract: getAssetCostDefault('targetDSCRContract', asset.type, asset.capacity),
          targetDSCRMerchant: getAssetCostDefault('targetDSCRMerchant', asset.type, asset.capacity),
          interestRate: getAssetCostDefault('interestRate', asset.type, asset.capacity) / 100,
          tenorYears: getAssetCostDefault('tenorYears', asset.type, asset.capacity)
        }
      });
    }

    // Process the value
    const processedValue = field === 'maxGearing' || field === 'interestRate' 
      ? parseFloat(value) / 100 
      : parseFloat(value);
    
    updateConstants('assetCosts', {
      ...constants.assetCosts,
      [assetName]: {
        ...constants.assetCosts[assetName],
        [field]: isNaN(processedValue) ? '' : processedValue
      }
    });
  }, [assets, constants.assetCosts, updateConstants, getAssetCostDefault]);

  // Validation helpers
  const isOpsStartValid = useCallback((asset) => {
    if (!asset.constructionStartDate || !asset.constructionDuration || !asset.assetStartDate) return true;
    
    const consStart = new Date(asset.constructionStartDate);
    const opsStart = new Date(asset.assetStartDate);
    const duration = parseInt(asset.constructionDuration) || 0;
    
    const expectedOpsStart = new Date(consStart);
    expectedOpsStart.setMonth(expectedOpsStart.getMonth() + duration);
    
    const expectedDateStr = expectedOpsStart.toISOString().split('T')[0];
    const actualDateStr = opsStart.toISOString().split('T')[0];
    
    return expectedDateStr === actualDateStr;
  }, []);

  const isContractStartValid = useCallback((asset, contract) => {
    if (!asset.assetStartDate || !contract.startDate) return null;
    
    const assetStart = new Date(asset.assetStartDate).toISOString().split('T')[0];
    const contractStart = new Date(contract.startDate).toISOString().split('T')[0];
    
    return assetStart === contractStart;
  }, []);

  const calculateContractTenor = useCallback((contract) => {
    if (!contract.startDate || !contract.endDate) return null;
    
    const start = new Date(contract.startDate);
    const end = new Date(contract.endDate);
    const diffTime = Math.abs(end - start);
    const diffYears = (diffTime / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1);
    return diffYears;
  }, []);

  // Field definitions
  const getAssetFields = useCallback(() => [
    { label: 'Name', field: 'name', type: 'text' },
    { label: 'State', field: 'state', type: 'select', options: ['NSW', 'VIC', 'SA', 'QLD'] },
    { label: 'Type', field: 'type', type: 'select', options: ['solar', 'wind', 'storage'] },
    { label: 'Capacity (MW)', field: 'capacity', type: 'number' },
    { label: 'Cons Start', field: 'constructionStartDate', type: 'date' },
    { label: 'Cons Duration (months)', field: 'constructionDuration', type: 'number' },
    { label: 'Ops Start', field: 'assetStartDate', type: 'date' },
    { label: 'Asset Life (years)', field: 'assetLife', type: 'number' },
    { label: 'Volume Loss Adjustment (%)', field: 'volumeLossAdjustment', type: 'number' },
  ], []);

  const getAdvancedFields = useCallback(() => [
    { label: 'Annual Degradation (%)', field: 'annualDegradation', type: 'number' },
    { label: 'Q1 Capacity Factor (%)', field: 'qtrCapacityFactor_q1', type: 'number' },
    { label: 'Q2 Capacity Factor (%)', field: 'qtrCapacityFactor_q2', type: 'number' },
    { label: 'Q3 Capacity Factor (%)', field: 'qtrCapacityFactor_q3', type: 'number' },
    { label: 'Q4 Capacity Factor (%)', field: 'qtrCapacityFactor_q4', type: 'number' },
  ], []);

  const getContractFields = useCallback(() => [
    { label: 'Counterparty', field: 'counterparty', type: 'text' },
    { label: 'Type', field: 'type', type: 'select', options: ['bundled', 'green', 'Energy', 'fixed', 'cfd', 'tolling'] },
    { label: 'Start Date', field: 'startDate', type: 'date' },
    { label: 'End Date', field: 'endDate', type: 'date' },
    { label: 'Strike Price ($)', field: 'strikePrice', type: 'number' },
    { label: 'Energy Price ($)', field: 'EnergyPrice', type: 'number' },
    { label: 'Green Price ($)', field: 'greenPrice', type: 'number' },
    { label: 'Buyer\'s Percentage (%)', field: 'buyersPercentage', type: 'number' },
    { label: 'Indexation (%)', field: 'indexation', type: 'number' },
  ], []);

  return {
    // State
    assets,
    editState,
    constants,
    corporateTaxRate,
    deprecationPeriods,
    
    // Field definitions
    getAssetFields,
    getAdvancedFields,
    getContractFields,
    
    // Update handlers
    handleFieldUpdate,
    handleDateFieldUpdate,
    handleConstructionDurationUpdate,
    handleContractUpdate,
    handleAssetCostChange,
    
    // Tax and depreciation
    handleTaxRateChange,
    handleDepreciationChange,
    
    // Contract management
    addContractToAll,
    getAllContractIds,
    
    // Actions
    saveChanges,
    
    // Validation
    isOpsStartValid,
    isContractStartValid,
    calculateContractTenor,
    
    // Utilities
    getValueStyle,
    getAssetCostDefault,
    formatNumericValue,
  };
};