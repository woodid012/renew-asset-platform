// hooks/useAssetManagement.js
import { useState, useCallback } from 'react';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { 
  calculateYear1Volume, 
  handleNumericInput,
  getDefaultCapacityFactors,
  createNewContract,
  updateBundledPrices
} from '@/utils/assetUtils';
import {
  getDefaultValue,
  DEFAULT_PROJECT_FINANCE
} from '@/lib/default_constants';

export const useAssetManagement = () => {
  const { 
    assets, 
    setAssets, 
    constants, 
    updateConstants 
  } = usePortfolio();

  const [newAssets, setNewAssets] = useState(new Set());

  // Helper function to get default values for asset costs
  const getAssetCostDefault = useCallback((field, assetType, capacity) => {
    const parsedCapacity = parseFloat(capacity) || 100;
    
    switch(field) {
      case 'capex':
        return getDefaultValue('capex', 'default', assetType) * parsedCapacity;
      case 'operatingCosts':
        return getDefaultValue('opex', 'default', assetType) * parsedCapacity;
      case 'operatingCostEscalation':
        return DEFAULT_PROJECT_FINANCE.opexEscalation;
      case 'terminalValue':
        return getDefaultValue('terminal', 'default', assetType) * parsedCapacity;
      case 'maxGearing':
        return DEFAULT_PROJECT_FINANCE.maxGearing / 100;
      case 'targetDSCRContract':
        return DEFAULT_PROJECT_FINANCE.targetDSCRContract;
      case 'targetDSCRMerchant':
        return DEFAULT_PROJECT_FINANCE.targetDSCRMerchant;
      case 'interestRate':
        return DEFAULT_PROJECT_FINANCE.interestRate / 100;
      case 'tenorYears':
        return getDefaultValue('finance', 'tenorYears', assetType);
      default:
        return 0;
    }
  }, []);

  // Asset CRUD operations
  const addNewAsset = useCallback(() => {
    const newId = String(Object.keys(assets).length + 1);
    const assetNumber = Object.keys(assets).length + 1;
    
    const newAsset = {
      id: newId,
      name: `Default Asset ${assetNumber}`,
      state: 'NSW',
      assetStartDate: '2024-01-01',
      capacity: '100',
      type: 'solar',
      volumeLossAdjustment: '100',
      assetLife: '35',
      contracts: []
    };

    setAssets(prev => ({
      ...prev,
      [newId]: newAsset
    }));
    
    setNewAssets(prev => new Set([...prev, newId]));
    return newId;
  }, [assets, setAssets]);

  const updateAsset = useCallback((id, field, value) => {
    setAssets(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  }, [setAssets]);

  const removeAsset = useCallback((id) => {
    setAssets(prev => {
      const newAssets = { ...prev };
      delete newAssets[id];
      return newAssets;
    });
    
    setNewAssets(prev => {
      const updated = new Set(prev);
      updated.delete(id);
      return updated;
    });
  }, [setAssets]);

  // Enhanced field update with options
  const handleFieldUpdate = useCallback((id, field, value, options = {}) => {
    const processedValue = handleNumericInput(value, options);
    updateAsset(id, field, processedValue);
  }, [updateAsset]);

  // Date utilities
  const roundToFirstOfMonth = useCallback((dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    date.setDate(1);
    return date.toISOString().split('T')[0];
  }, []);

  const addMonthsToDate = useCallback((dateStr, months) => {
    if (!dateStr || !months) return '';
    const date = new Date(dateStr);
    date.setMonth(date.getMonth() + parseInt(months));
    date.setDate(1);
    return date.toISOString().split('T')[0];
  }, []);

  const calculateMonthsBetween = useCallback((startDateStr, endDateStr) => {
    if (!startDateStr || !endDateStr) return '';
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    
    const yearDiff = endDate.getFullYear() - startDate.getFullYear();
    const monthDiff = endDate.getMonth() - startDate.getMonth();
    
    return yearDiff * 12 + monthDiff;
  }, []);

  // Enhanced date field handler with automatic calculation
  const handleDateFieldUpdate = useCallback((id, field, value) => {
    const roundedValue = roundToFirstOfMonth(value);
    updateAsset(id, field, roundedValue);
    
    const asset = assets[id];
    if (!asset) return;
    
    if (field === 'constructionStartDate' && asset.constructionDuration) {
      const newOpsStart = addMonthsToDate(roundedValue, asset.constructionDuration);
      if (newOpsStart !== asset.assetStartDate) {
        updateAsset(id, 'assetStartDate', newOpsStart);
      }
    } else if (field === 'assetStartDate' && asset.constructionStartDate) {
      const newDuration = calculateMonthsBetween(asset.constructionStartDate, roundedValue);
      if (newDuration !== asset.constructionDuration) {
        updateAsset(id, 'constructionDuration', newDuration);
      }
    }
  }, [roundToFirstOfMonth, updateAsset, assets, addMonthsToDate, calculateMonthsBetween]);

  // Construction duration handler
  const handleConstructionDurationUpdate = useCallback((id, value) => {
    const processedValue = handleNumericInput(value, { round: true });
    updateAsset(id, 'constructionDuration', processedValue);
    
    const asset = assets[id];
    if (asset?.constructionStartDate && processedValue) {
      const newOpsStart = addMonthsToDate(asset.constructionStartDate, processedValue);
      if (newOpsStart !== asset.assetStartDate) {
        updateAsset(id, 'assetStartDate', newOpsStart);
      }
    }
  }, [handleNumericInput, updateAsset, assets, addMonthsToDate]);

  // Asset costs management
  const initializeAssetCosts = useCallback((assetName, assetType, capacity) => {
    if (!constants.assetCosts[assetName]) {
      const newAssetCosts = {
        ...constants.assetCosts,
        [assetName]: {
          capex: getAssetCostDefault('capex', assetType, capacity),
          operatingCosts: getAssetCostDefault('operatingCosts', assetType, capacity),
          operatingCostEscalation: getAssetCostDefault('operatingCostEscalation', assetType, capacity),
          terminalValue: getAssetCostDefault('terminalValue', assetType, capacity),
          maxGearing: getAssetCostDefault('maxGearing', assetType, capacity),
          targetDSCRContract: getAssetCostDefault('targetDSCRContract', assetType, capacity),
          targetDSCRMerchant: getAssetCostDefault('targetDSCRMerchant', assetType, capacity),
          interestRate: getAssetCostDefault('interestRate', assetType, capacity),
          tenorYears: getAssetCostDefault('tenorYears', assetType, capacity)
        }
      };
      
      updateConstants('assetCosts', newAssetCosts);
    }
  }, [constants.assetCosts, getAssetCostDefault, updateConstants]);

  const updateAssetCost = useCallback((assetName, field, value) => {
    let processedValue = value === '' ? '' : parseFloat(value);
    
    if (field === 'maxGearing' || field === 'interestRate') {
      processedValue = processedValue === '' ? '' : processedValue / 100;
    }
    
    const newAssetCosts = {
      ...constants.assetCosts,
      [assetName]: {
        ...constants.assetCosts[assetName],
        [field]: processedValue
      }
    };
    
    updateConstants('assetCosts', newAssetCosts);
  }, [constants.assetCosts, updateConstants]);

  // Contract management
  const updateAssetContracts = useCallback((id, contracts) => {
    updateAsset(id, 'contracts', contracts);
  }, [updateAsset]);

  const addContract = useCallback((assetId) => {
    const asset = assets[assetId];
    if (!asset) return;
    
    const newContract = createNewContract(asset.contracts, asset.assetStartDate);
    updateAssetContracts(assetId, [...asset.contracts, newContract]);
  }, [assets, updateAssetContracts]);

  const removeContract = useCallback((assetId, contractId) => {
    const asset = assets[assetId];
    if (!asset) return;
    
    const updatedContracts = asset.contracts.filter(c => c.id !== contractId);
    updateAssetContracts(assetId, updatedContracts);
  }, [assets, updateAssetContracts]);

  const updateContract = useCallback((assetId, contractId, field, value) => {
    const asset = assets[assetId];
    if (!asset) return;
    
    const updatedContracts = asset.contracts.map(contract => {
      if (contract.id !== contractId) return contract;
      
      const updatedContract = updateBundledPrices({...contract}, field, value);
      
      if (['strikePrice', 'EnergyPrice', 'greenPrice', 'buyersPercentage', 'indexation'].includes(field)) {
        updatedContract[field] = value === '' ? '' : value;
      } else {
        updatedContract[field] = value;
      }
      
      return updatedContract;
    });

    updateAssetContracts(assetId, updatedContracts);
  }, [assets, updateAssetContracts]);

  // Capacity factors management
  const updateCapacityFactors = useCallback((assetId) => {
    const asset = assets[assetId];
    if (!asset) return;
    
    const factors = getDefaultCapacityFactors(asset, constants);
    Object.entries(factors).forEach(([key, value]) => {
      if (key === 'annual') {
        updateAsset(assetId, 'capacityFactor', value);
      } else {
        updateAsset(assetId, `qtrCapacityFactor_${key}`, value);
      }
    });
  }, [assets, constants, updateAsset]);

  // Calculated values
  const getYear1Volume = useCallback((assetId) => {
    const asset = assets[assetId];
    return asset ? calculateYear1Volume(asset) : null;
  }, [assets]);

  const getAssetCosts = useCallback((assetName) => {
    return constants.assetCosts?.[assetName] || {};
  }, [constants.assetCosts]);

  return {
    // State
    assets,
    newAssets,
    constants,
    
    // Asset operations
    addNewAsset,
    updateAsset,
    removeAsset,
    handleFieldUpdate,
    handleDateFieldUpdate,
    handleConstructionDurationUpdate,
    
    // Asset costs
    initializeAssetCosts,
    updateAssetCost,
    getAssetCosts,
    getAssetCostDefault,
    
    // Contracts
    updateAssetContracts,
    addContract,
    removeContract,
    updateContract,
    
    // Capacity factors
    updateCapacityFactors,
    
    // Utilities
    getYear1Volume,
    roundToFirstOfMonth,
    addMonthsToDate,
    calculateMonthsBetween,
  };
};