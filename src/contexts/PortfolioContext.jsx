// src/contexts/PortfolioContext.jsx - Updated for MongoDB
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import _ from 'lodash';
import { MerchantPriceProvider, useMerchantPrices } from './MerchantPriceProvider';
import {
  DEFAULT_CAPEX_RATES,
  DEFAULT_OPEX_RATES,
  DEFAULT_PROJECT_FINANCE,
  DEFAULT_PLATFORM_COSTS,
  DEFAULT_TAX_DEPRECIATION,
  DEFAULT_DISCOUNT_RATES,
  DEFAULT_RISK_PARAMETERS,
  DEFAULT_PRICE_SETTINGS,
  DEFAULT_DATA_SOURCES,
  DEFAULT_ASSET_PERFORMANCE,
  DEFAULT_TERMINAL_RATES,
  DEFAULT_ANALYSIS_SETTINGS,
  DEFAULT_SYSTEM_CONSTANTS,
  DEFAULT_CAPACITY_FACTORS,
  getDefaultValue
} from '../lib/default_constants';

// API configuration
const API_BASE = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3001/api';

// API service functions
const apiService = {
  async savePortfolio(userId, portfolioId, portfolioData) {
    const response = await fetch(`${API_BASE}/portfolio/${userId}/${portfolioId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(portfolioData)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to save portfolio: ${response.statusText}`);
    }
    
    return response.json();
  },

  async loadPortfolio(userId, portfolioId) {
    const response = await fetch(`${API_BASE}/portfolio/${userId}/${portfolioId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null; // Portfolio doesn't exist
      }
      throw new Error(`Failed to load portfolio: ${response.statusText}`);
    }
    
    return response.json();
  },

  async getUserPortfolios(userId) {
    const response = await fetch(`${API_BASE}/portfolios/${userId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get portfolios: ${response.statusText}`);
    }
    
    return response.json();
  },

  async deletePortfolio(userId, portfolioId) {
    const response = await fetch(`${API_BASE}/portfolio/${userId}/${portfolioId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete portfolio: ${response.statusText}`);
    }
    
    return response.json();
  },

  async login(username, password) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    if (!response.ok) {
      throw new Error('Invalid credentials');
    }
    
    return response.json();
  }
};

// Helper function for cost scaling
const calculateFixedCost = (baseFixedCost, capacity, baseCapacity, scaleFactor) => {
  return baseFixedCost * Math.pow(capacity / baseCapacity, scaleFactor);
};

// Context creation
const PortfolioContext = createContext();

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
}

// Safe hook to use scenarios
function useScenariosOrNull() {
  try {
    const { useScenarios } = require('./ScenarioContext');
    return useScenarios();
  } catch (error) {
    return null;
  }
}

// Internal wrapper component
function PortfolioProviderInner({ children }) {
  const { merchantPrices, getMerchantPrice, getMerchantSpread, priceSource, setPriceSource } = useMerchantPrices();
  const scenarioContext = useScenariosOrNull();
  
  // Add loading and save states
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [autoSave, setAutoSave] = useState(true);
  
  const [portfolioSource, setPortfolioSource] = useState('mongodb');
  const [activePortfolio, setActivePortfolio] = useState('default');
  const [analysisMode, setAnalysisMode] = useState('simple');
  const [portfolioName, setPortfolioName] = useState("Portfolio Name");
  
  // Base data
  const [baseAssets, setBaseAssets] = useState({});
  const [baseConstants, setBaseConstants] = useState({
    HOURS_IN_YEAR: DEFAULT_SYSTEM_CONSTANTS.HOURS_IN_YEAR,
    priceAggregation: DEFAULT_SYSTEM_CONSTANTS.priceAggregation,
    capacityFactors: DEFAULT_CAPACITY_FACTORS.annual,
    capacityFactors_qtr: DEFAULT_CAPACITY_FACTORS.quarterly,
    annualDegradation: DEFAULT_ASSET_PERFORMANCE.annualDegradation,
    merchantPrices: merchantPrices,
    volumeVariation: DEFAULT_RISK_PARAMETERS.volumeVariation,
    greenPriceVariation: DEFAULT_RISK_PARAMETERS.greenPriceVariation,
    EnergyPriceVariation: DEFAULT_RISK_PARAMETERS.EnergyPriceVariation,
    discountRates: {
      contract: DEFAULT_DISCOUNT_RATES.contract / 100,
      merchant: DEFAULT_DISCOUNT_RATES.merchant / 100
    },
    assetCosts: {},
    escalation: DEFAULT_PRICE_SETTINGS.escalation,
    referenceYear: DEFAULT_PRICE_SETTINGS.referenceYear,
    analysisStartYear: DEFAULT_ANALYSIS_SETTINGS.analysisStartYear,
    analysisEndYear: DEFAULT_ANALYSIS_SETTINGS.analysisEndYear,
    platformOpex: DEFAULT_PLATFORM_COSTS.platformOpex,
    otherOpex: DEFAULT_PLATFORM_COSTS.otherOpex,
    platformOpexEscalation: DEFAULT_PLATFORM_COSTS.platformOpexEscalation,
    dividendPolicy: DEFAULT_PLATFORM_COSTS.dividendPolicy,
    minimumCashBalance: DEFAULT_PLATFORM_COSTS.minimumCashBalance,
    corporateTaxRate: DEFAULT_TAX_DEPRECIATION.corporateTaxRate,
    deprecationPeriods: DEFAULT_TAX_DEPRECIATION.deprecationPeriods
  });

  // Computed scenario-aware values
  const assets = scenarioContext?.getScenarioAssets ? 
    scenarioContext.getScenarioAssets(baseAssets) : 
    baseAssets;
    
  const constants = scenarioContext?.getScenarioConstants ? 
    scenarioContext.getScenarioConstants(baseConstants) : 
    baseConstants;

  // Auto-save timer ref
  const autoSaveTimerRef = useRef(null);

  // Get current user
  const getCurrentUser = () => {
    return sessionStorage.getItem('currentUser') || 'guest';
  };

  // Auto-save function
  const triggerAutoSave = useCallback(async () => {
    if (!autoSave || isSaving) return;
    
    const userId = getCurrentUser();
    if (userId === 'guest') return;

    try {
      setIsSaving(true);
      const exportData = exportPortfolioData();
      await apiService.savePortfolio(userId, activePortfolio, exportData);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Auto-save failed:', error);
      // Don't show error to user for auto-save failures
    } finally {
      setIsSaving(false);
    }
  }, [autoSave, isSaving, activePortfolio, baseAssets, baseConstants, portfolioName, analysisMode, priceSource]);

  // Debounced auto-save
  const scheduleAutoSave = useCallback(() => {
    if (!autoSave) return;
    
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    autoSaveTimerRef.current = setTimeout(triggerAutoSave, 5000); // Save after 5 seconds of inactivity
  }, [triggerAutoSave, autoSave]);

  // Initialize asset costs
  const initializeAssetCosts = useCallback((assets) => {
    const newAssetCosts = {};
    Object.values(assets).forEach(asset => {
      const assetType = asset.type === 'battery' ? 'storage' : asset.type;
      
      const defaultCapex = getDefaultValue('capex', null, assetType) || DEFAULT_CAPEX_RATES.default;
      const defaultOpex = getDefaultValue('opex', null, assetType) || DEFAULT_OPEX_RATES.default;
      const defaultTerminal = getDefaultValue('terminal', null, assetType) || DEFAULT_TERMINAL_RATES.default;
      const defaultTenor = getDefaultValue('finance', 'tenorYears', assetType) || DEFAULT_PROJECT_FINANCE.tenorYears.default;
      
      const projCapex = defaultCapex * asset.capacity;
      const projOpex = defaultOpex * asset.capacity;
      
      const baseCapacity = 100;
      const scaleFactor = 0.75;
      const scaledOperatingCost = Math.min(
        calculateFixedCost(
          defaultTerminal * baseCapacity * 0.1,
          asset.capacity,
          baseCapacity,
          scaleFactor
        ),
        projOpex
      );

      newAssetCosts[asset.name] = {
        operatingCosts: Number(scaledOperatingCost.toFixed(2)),
        operatingCostEscalation: DEFAULT_PROJECT_FINANCE.opexEscalation,
        terminalValue: Number((defaultTerminal * asset.capacity).toFixed(2)),
        capex: Number(projCapex.toFixed(1)),
        maxGearing: DEFAULT_PROJECT_FINANCE.maxGearing / 100,
        targetDSCRContract: DEFAULT_PROJECT_FINANCE.targetDSCRContract,
        targetDSCRMerchant: DEFAULT_PROJECT_FINANCE.targetDSCRMerchant,
        interestRate: DEFAULT_PROJECT_FINANCE.interestRate / 100,
        tenorYears: defaultTenor,
        calculatedGearing: DEFAULT_PROJECT_FINANCE.maxGearing / 100
      };
    });
    return newAssetCosts;
  }, []);

  // Update merchant prices
  useEffect(() => {
    setBaseConstants(prev => ({
      ...prev,
      merchantPrices
    }));
  }, [merchantPrices]);

  // Initialize asset costs when assets change
  useEffect(() => {
    if (Object.keys(baseAssets).length > 0 && 
        (!baseConstants.assetCosts || Object.keys(baseConstants.assetCosts).length === 0)) {
      setBaseConstants(prev => ({
        ...prev,
        assetCosts: initializeAssetCosts(baseAssets)
      }));
    }
  }, [baseAssets, baseConstants.assetCosts, initializeAssetCosts]);

  // Load portfolio from MongoDB
  const loadPortfolioFromDB = useCallback(async (userId, portfolioId) => {
    try {
      setIsLoading(true);
      const portfolio = await apiService.loadPortfolio(userId, portfolioId);
      
      if (portfolio) {
        setBaseAssets(portfolio.assets || {});
        setPortfolioName(portfolio.portfolioName || 'Untitled Portfolio');
        
        if (portfolio.constants) {
          setBaseConstants(prev => ({
            ...prev,
            ...portfolio.constants
          }));
        }
        
        if (portfolio.analysisMode) setAnalysisMode(portfolio.analysisMode);
        if (portfolio.priceSource) setPriceSource(portfolio.priceSource);
        
        setLastSaved(new Date(portfolio.lastUpdated));
        console.log('Portfolio loaded from MongoDB:', portfolioId);
      } else {
        // Portfolio doesn't exist, create new one
        console.log('Creating new portfolio:', portfolioId);
        setBaseAssets({});
        setPortfolioName('New Portfolio');
      }
    } catch (error) {
      console.error('Error loading portfolio from MongoDB:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [setPriceSource]);

  // Save portfolio to MongoDB
  const savePortfolioDB = useCallback(async (showSuccess = true) => {
    const userId = getCurrentUser();
    if (userId === 'guest') {
      alert('Please log in to save portfolios');
      return false;
    }

    try {
      setIsSaving(true);
      const exportData = exportPortfolioData();
      await apiService.savePortfolio(userId, activePortfolio, exportData);
      setLastSaved(new Date());
      
      if (showSuccess) {
        alert('Portfolio saved successfully!');
      }
      return true;
    } catch (error) {
      console.error('Error saving portfolio:', error);
      alert(`Error saving portfolio: ${error.message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [activePortfolio, baseAssets, baseConstants, portfolioName, analysisMode, priceSource]);

  // Import portfolio data
  const importPortfolioData = useCallback((importedData) => {
    try {
      if (!importedData.assets || !importedData.version) {
        throw new Error('Invalid import data structure');
      }

      setBaseAssets(importedData.assets);
      if (importedData.portfolioName) {
        setPortfolioName(importedData.portfolioName);
      }

      if (importedData.constants && importedData.constants.assetCosts) {
        if (importedData.constants) {
          const mergedConstants = {
            ...baseConstants,
            ...importedData.constants,
          };
          setBaseConstants(mergedConstants);
        }
      } else {
        const tmpAssets = {};
        Object.entries(importedData.assets).forEach(([id, asset]) => {
          tmpAssets[asset.name] = asset;
        });
        
        const initializedAssetCosts = initializeAssetCosts(tmpAssets);
        
        setBaseConstants(prev => ({
          ...prev,
          ...(importedData.constants || {}),
          assetCosts: initializedAssetCosts
        }));
      }

      if (importedData.analysisMode) setAnalysisMode(importedData.analysisMode);
      if (importedData.activePortfolio) setActivePortfolio(importedData.activePortfolio);
      if (importedData.priceSource) setPriceSource(importedData.priceSource);

      // Schedule auto-save for imported data
      scheduleAutoSave();
      
      console.log('Portfolio data imported successfully');
    } catch (error) {
      console.error('Error importing portfolio data:', error);
      throw error;
    }
  }, [setPriceSource, initializeAssetCosts, baseConstants, scheduleAutoSave]);

  // Export portfolio data
  const exportPortfolioData = useCallback(() => {
    const exportData = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      portfolioName,
      assets: baseAssets,
      constants: {
        discountRates: baseConstants.discountRates,
        assetCosts: baseConstants.assetCosts,
        volumeVariation: baseConstants.volumeVariation,
        greenPriceVariation: baseConstants.greenPriceVariation,
        EnergyPriceVariation: baseConstants.EnergyPriceVariation,
        escalation: baseConstants.escalation,
        referenceYear: baseConstants.referenceYear,
        priceAggregation: baseConstants.priceAggregation,
        analysisStartYear: baseConstants.analysisStartYear,
        analysisEndYear: baseConstants.analysisEndYear,
        platformOpex: baseConstants.platformOpex,
        otherOpex: baseConstants.otherOpex,
        platformOpexEscalation: baseConstants.platformOpexEscalation,
        dividendPolicy: baseConstants.dividendPolicy,
        minimumCashBalance: baseConstants.minimumCashBalance,
        corporateTaxRate: baseConstants.corporateTaxRate,
        deprecationPeriods: baseConstants.deprecationPeriods
      },
      analysisMode,
      activePortfolio,
      portfolioSource,
      priceSource
    };

    return exportData;
  }, [baseAssets, portfolioName, baseConstants, analysisMode, activePortfolio, portfolioSource, priceSource]);

  // Update analysis mode
  const updateAnalysisMode = useCallback((mode) => {
    setAnalysisMode(mode);
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  // Update constants
  const updateConstants = useCallback((field, value) => {
    setBaseConstants(prev => {
      if (field.includes('.')) {
        const fields = field.split('.');
        const newConstants = { ...prev };
        let current = newConstants;
        
        for (let i = 0; i < fields.length - 1; i++) {
          if (!current[fields[i]]) {
            current[fields[i]] = {};
          }
          current[fields[i]] = { ...current[fields[i]] };
          current = current[fields[i]];
        }
        
        current[fields[fields.length - 1]] = value;
        return newConstants;
      }

      return {
        ...prev,
        [field]: value
      };
    });
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  // Update assets
  const setAssets = useCallback((newAssets) => {
    setBaseAssets(newAssets);
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  // Load portfolio on mount if user is logged in
  useEffect(() => {
    const userId = getCurrentUser();
    if (userId !== 'guest') {
      loadPortfolioFromDB(userId, activePortfolio);
    }
  }, [activePortfolio, loadPortfolioFromDB]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const value = {
    // Base data
    baseAssets,
    baseConstants,
    setAssets,
    
    // Scenario-aware data
    assets,
    constants,
    
    portfolioName,
    setPortfolioName: (name) => {
      setPortfolioName(name);
      scheduleAutoSave();
    },
    activePortfolio,
    setActivePortfolio,
    updateConstants,
    getMerchantPrice,
    getMerchantSpread,
    portfolioSource,
    setPortfolioSource,
    priceCurveSource: priceSource,
    setPriceCurveSource: setPriceSource,
    analysisMode,
    updateAnalysisMode,
    exportPortfolioData,
    importPortfolioData,
    
    // MongoDB functions
    savePortfolioDB,
    loadPortfolioFromDB,
    
    // Loading states
    isLoading,
    isSaving,
    lastSaved,
    autoSave,
    setAutoSave,
    
    // Manual save trigger
    scheduleAutoSave,
    
    // Scenario awareness
    currentScenario: scenarioContext?.activeScenario || 'base',
    scenarioAvailable: !!scenarioContext
  };

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
}

// Main provider
export function PortfolioProvider({ children }) {
  return (
    <MerchantPriceProvider>
      <PortfolioProviderInner>
        {children}
      </PortfolioProviderInner>
    </MerchantPriceProvider>
  );
}

export default PortfolioProvider;