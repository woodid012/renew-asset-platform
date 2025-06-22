// hooks/useContractForm.js
import { useCallback } from 'react';

export const useContractForm = ({
  contract,
  updateContract,
  isStorage,
  capacity,
  capacityFactor,
  volumeLossAdjustment,
  volume
}) => {
  
  // Helper function to safely handle numeric inputs
  const handleNumericInput = useCallback((field, value) => {
    // Always pass through empty string to allow typing
    if (value === '') {
      updateContract(field, '');
      return;
    }
    
    // Only parse if it's a valid number
    const parsed = Number(value);
    if (!isNaN(parsed)) {
      updateContract(field, parsed);
    }
  }, [updateContract]);

  // Calculate contract duration in years
  const calculateTenor = useCallback(() => {
    if (!contract.startDate || !contract.endDate) return null;
    
    const start = new Date(contract.startDate);
    const end = new Date(contract.endDate);
    const diffTime = Math.abs(end - start);
    const diffYears = (diffTime / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1);
    return diffYears;
  }, [contract.startDate, contract.endDate]);

  // Handle contract type change and set buyersPercentage to 100 for storage tolling
  const handleContractTypeChange = useCallback((value) => {
    updateContract('type', value);
    
    // For storage assets with tolling contracts, always set buyersPercentage to 100
    if (isStorage && value === 'tolling') {
      updateContract('buyersPercentage', 100);
    }
  }, [updateContract, isStorage]);

  // Get contract type options based on asset type
  const getContractTypeOptions = useCallback(() => {
    if (isStorage) {
      return [
        { value: 'cfd', label: 'CfD' },
        { value: 'fixed', label: 'Fixed Revenue' },
        { value: 'tolling', label: 'Tolling' }
      ];
    } else {
      return [
        { value: 'bundled', label: 'Bundled PPA' },
        { value: 'green', label: 'Green Only' },
        { value: 'Energy', label: 'Energy Only' },
        { value: 'fixed', label: 'Fixed Revenue' }
      ];
    }
  }, [isStorage]);

  // Get the appropriate label for the revenue/price field
  const getRevenueLabel = useCallback(() => {
    if (contract.type === 'fixed') {
      return 'Annual Revenue ($M)';
    }
    
    if (isStorage) {
      switch (contract.type) {
        case 'tolling':
          return 'Price ($/MW/hr)';
        case 'fixed':
          return 'Annual Revenue ($M)';
        default:
          return 'Price Spread ($/MWh)';
      }
    }
    
    return 'Strike Price ($)';
  }, [contract.type, isStorage]);

  // Determine if buyer's percentage should be shown
  const shouldShowBuyersPercentage = useCallback(() => {
    return contract.type !== 'fixed';
  }, [contract.type]);

  // Determine if buyer's percentage should be disabled
  const isBuyersPercentageDisabled = useCallback(() => {
    return isStorage && contract.type === 'tolling';
  }, [isStorage, contract.type]);

  // Calculate annual revenue for display
  const calculateAnnualRevenue = useCallback(() => {
    if (!contract.strikePrice) return null;

    // Storage Tolling Contract
    if (isStorage && contract.type === 'tolling') {
      const annualRevenue = (8760 * contract.strikePrice * capacity) / 1000000;
      return {
        display: `$${annualRevenue.toFixed(2)}M per year`,
        description: `Based on ${capacity} MW × 8,760 hours × $${contract.strikePrice}/MW/hr`
      };
    }

    // Storage CfD Contract
    if (isStorage && contract.type === 'cfd' && volume && contract.buyersPercentage) {
      const annualRevenue = (contract.strikePrice * volume * 365 * (volumeLossAdjustment/100) * (contract.buyersPercentage / 100)) / 1000000;
      return {
        display: `$${annualRevenue.toFixed(2)}M per year`,
        description: `Based on ${volume} MWh × 365 days × $${contract.strikePrice} spread × ${volumeLossAdjustment}% efficiency × ${contract.buyersPercentage}% contracted`
      };
    }

    // Renewable PPA Revenue Calculation (Bundled)
    if (!isStorage && contract.type === 'bundled' && contract.buyersPercentage) {
      const baseRevenue = 8760 * capacity * (capacityFactor/100) * (contract.buyersPercentage/100);
      const energyPrice = contract.EnergyPrice || 0;
      const greenPrice = contract.greenPrice || 0;
      const energyRevenue = (baseRevenue * energyPrice) / 1000000;
      const greenRevenue = (baseRevenue * greenPrice) / 1000000;
      const totalRevenue = energyRevenue + greenRevenue;
      
      return {
        display: `$${totalRevenue.toFixed(2)}M per year (Energy = $${energyRevenue.toFixed(2)}M, Green = $${greenRevenue.toFixed(2)}M)`,
        description: `Based on ${capacity} MW × ${capacityFactor}% CF × 8,760 hours × $${contract.strikePrice}/MWh × ${contract.buyersPercentage}% contracted`
      };
    }

    // Other renewable contracts (non-bundled)
    if (!isStorage && contract.type !== 'bundled' && contract.type !== 'fixed' && contract.buyersPercentage) {
      const baseRevenue = 8760 * capacity * (capacityFactor/100) * (contract.buyersPercentage/100);
      const annualRevenue = (baseRevenue * contract.strikePrice) / 1000000;
      
      return {
        display: `$${annualRevenue.toFixed(2)}M per year`,
        description: `Based on ${capacity} MW × ${capacityFactor}% CF × 8,760 hours × $${contract.strikePrice}/MWh × ${contract.buyersPercentage}% contracted`
      };
    }

    return null;
  }, [
    contract.strikePrice, 
    contract.type, 
    contract.buyersPercentage,
    contract.EnergyPrice,
    contract.greenPrice,
    isStorage, 
    capacity, 
    capacityFactor, 
    volumeLossAdjustment, 
    volume
  ]);

  return {
    handleNumericInput,
    handleContractTypeChange,
    calculateTenor,
    calculateAnnualRevenue,
    getContractTypeOptions,
    getRevenueLabel,
    shouldShowBuyersPercentage,
    isBuyersPercentageDisabled
  };
};