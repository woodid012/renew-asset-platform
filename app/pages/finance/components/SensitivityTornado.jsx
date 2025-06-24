// components/SensitivityTornado.jsx
'use client'

import { useState, useEffect } from 'react';
import { Table, RefreshCw, BarChart3 } from 'lucide-react';
import { calculateIRR } from '@/app/components/ProjectFinance_Calcs';

export default function SensitivityTornado({ 
  projectMetrics, 
  assets, 
  constants, 
  getMerchantPrice, 
  analysisYears, 
  selectedRevenueCase,
  includeTerminalValue,
  portfolioTotals
}) {
  const [sensitivityData, setSensitivityData] = useState([]);
  const [calculating, setCalculating] = useState(false);
  const [baseIRR, setBaseIRR] = useState(0);
  
  // Sensitivity range inputs
  const [ranges, setRanges] = useState({
    capex: 10,
    electricityPrice: 10,
    volume: 10,
    interestRate: 1,
    opex: 10,
    terminalValue: 50
  });

  const updateRange = (parameter, value) => {
    setRanges(prev => ({
      ...prev,
      [parameter]: Math.max(0.1, Math.min(100, parseFloat(value) || 0))
    }));
  };

  // Calculate base IRR to match dashboard
  const getBaseIRR = () => {
    let calculatedBaseIRR = 0;
    
    try {
      // Use portfolioTotals if available (same as dashboard)
      if (portfolioTotals?.equityCashFlows && portfolioTotals.equityCashFlows.length > 0) {
        const irr = calculateIRR(portfolioTotals.equityCashFlows);
        calculatedBaseIRR = irr ? irr * 100 : 0;
        console.log('Using portfolioTotals IRR:', calculatedBaseIRR);
      } else {
        console.log('portfolioTotals not available, using fallback');
        // Fallback to project metrics
        const individualAssets = Object.entries(projectMetrics)
          .filter(([assetName]) => assetName !== 'portfolio');
        
        if (individualAssets.length > 0) {
          const allEquityCashFlows = [];
          
          individualAssets.forEach(([assetName, assetMetrics]) => {
            if (assetMetrics.equityCashFlows && assetMetrics.equityCashFlows.length > 0) {
              const truncatedCashFlows = assetMetrics.equityCashFlows.slice(0, analysisYears + 1);
              
              if (allEquityCashFlows.length === 0) {
                allEquityCashFlows.push(...truncatedCashFlows.map(cf => cf));
              } else {
                truncatedCashFlows.forEach((cf, index) => {
                  if (index < allEquityCashFlows.length) {
                    allEquityCashFlows[index] += cf;
                  } else {
                    allEquityCashFlows.push(cf);
                  }
                });
              }
            }
          });
          
          if (allEquityCashFlows.length > 0) {
            const irr = calculateIRR(allEquityCashFlows);
            calculatedBaseIRR = irr ? irr * 100 : 0;
            console.log('Using combined individual assets IRR:', calculatedBaseIRR);
          }
        }
      }
    } catch (error) {
      console.error('Error calculating base IRR:', error);
    }
    
    return calculatedBaseIRR;
  };

  // Calculate Electricity Price sensitivity
  const calculateElectricityPriceSensitivity = async (baseIRRValue) => {
    try {
      const { calculateProjectMetrics } = await import('@/app/components/ProjectFinance_Calcs');
      
      const results = { upside: 0, downside: 0 };
      const range = ranges.electricityPrice;
      
      // Electricity Price +range% (higher prices = higher IRR = upside)
      console.log(`Calculating +${range}% Electricity Price scenario...`);
      
      const modifiedGetMerchantPriceUp = (profile, type, state, timeStr) => {
        const basePrice = getMerchantPrice(profile, type, state, timeStr);
        return basePrice * (1 + range/100);
      };
      
      const modifiedMetricsUp = calculateProjectMetrics(
        assets,
        constants.assetCosts,
        constants,
        modifiedGetMerchantPriceUp,
        selectedRevenueCase,
        false,
        includeTerminalValue
      );
      
      let modifiedIRRUp = 0;
      if (portfolioTotals?.equityCashFlows) {
        const individualAssets = Object.entries(modifiedMetricsUp)
          .filter(([assetName]) => assetName !== 'portfolio');
        
        const allEquityCashFlows = [];
        individualAssets.forEach(([_, metrics]) => {
          if (metrics.equityCashFlows && metrics.equityCashFlows.length > 0) {
            const truncatedCashFlows = metrics.equityCashFlows.slice(0, analysisYears + 1);
            
            if (allEquityCashFlows.length === 0) {
              allEquityCashFlows.push(...truncatedCashFlows.map(cf => cf));
            } else {
              truncatedCashFlows.forEach((cf, index) => {
                if (index < allEquityCashFlows.length) {
                  allEquityCashFlows[index] += cf;
                } else {
                  allEquityCashFlows.push(cf);
                }
              });
            }
          }
        });
        
        if (allEquityCashFlows.length > 0) {
          const irr = calculateIRR(allEquityCashFlows);
          modifiedIRRUp = irr ? irr * 100 : 0;
        }
      }
      
      const impactUp = modifiedIRRUp - baseIRRValue;
      results.upside = impactUp;
      console.log(`Electricity Price +${range}% impact:`, impactUp);
      
      // Electricity Price -range% (lower prices = lower IRR = downside)
      console.log(`Calculating -${range}% Electricity Price scenario...`);
      
      const modifiedGetMerchantPriceDown = (profile, type, state, timeStr) => {
        const basePrice = getMerchantPrice(profile, type, state, timeStr);
        return basePrice * (1 - range/100);
      };
      
      const modifiedMetricsDown = calculateProjectMetrics(
        assets,
        constants.assetCosts,
        constants,
        modifiedGetMerchantPriceDown,
        selectedRevenueCase,
        false,
        includeTerminalValue
      );
      
      let modifiedIRRDown = 0;
      if (portfolioTotals?.equityCashFlows) {
        const individualAssets = Object.entries(modifiedMetricsDown)
          .filter(([assetName]) => assetName !== 'portfolio');
        
        const allEquityCashFlows = [];
        individualAssets.forEach(([_, metrics]) => {
          if (metrics.equityCashFlows && metrics.equityCashFlows.length > 0) {
            const truncatedCashFlows = metrics.equityCashFlows.slice(0, analysisYears + 1);
            
            if (allEquityCashFlows.length === 0) {
              allEquityCashFlows.push(...truncatedCashFlows.map(cf => cf));
            } else {
              truncatedCashFlows.forEach((cf, index) => {
                if (index < allEquityCashFlows.length) {
                  allEquityCashFlows[index] += cf;
                } else {
                  allEquityCashFlows.push(cf);
                }
              });
            }
          }
        });
        
        if (allEquityCashFlows.length > 0) {
          const irr = calculateIRR(allEquityCashFlows);
          modifiedIRRDown = irr ? irr * 100 : 0;
        }
      }
      
      const impactDown = modifiedIRRDown - baseIRRValue;
      results.downside = impactDown;
      console.log(`Electricity Price -${range}% impact:`, impactDown);
      
      return results;
      
    } catch (error) {
      console.error('Error calculating Electricity Price sensitivity:', error);
      return { upside: 0, downside: 0 };
    }
  };

  // Calculate Volume sensitivity (replaces capacity factor)
  const calculateVolumeSensitivity = async (baseIRRValue) => {
    try {
      const { calculateProjectMetrics } = await import('@/app/components/ProjectFinance_Calcs');
      
      const results = { upside: 0, downside: 0 };
      const range = ranges.volume;
      
      // Volume +range% (higher volume = higher IRR = upside)
      console.log(`Calculating +${range}% Volume scenario...`);
      
      const modifiedAssetsUp = JSON.parse(JSON.stringify(assets)); // Deep copy
      Object.keys(modifiedAssetsUp).forEach(key => {
        const asset = modifiedAssetsUp[key];
        
        // Modify capacity factors for renewables
        ['q1', 'q2', 'q3', 'q4'].forEach(quarter => {
          const factorKey = `qtrCapacityFactor_${quarter}`;
          if (asset[factorKey] && asset[factorKey] !== '') {
            asset[factorKey] = (parseFloat(asset[factorKey]) * (1 + range/100)).toString();
          }
        });
        
        // Modify volume for storage assets
        if (asset.type === 'storage' && asset.volume) {
          asset.volume = parseFloat(asset.volume) * (1 + range/100);
        }
        
        // Modify volumeLossAdjustment if present
        if (asset.volumeLossAdjustment) {
          const currentAdjustment = parseFloat(asset.volumeLossAdjustment);
          const newAdjustment = Math.min(100, currentAdjustment * (1 + range/100/2)); // Half the impact for loss adjustment
          asset.volumeLossAdjustment = newAdjustment.toString();
        }
      });
      
      const modifiedMetricsUp = calculateProjectMetrics(
        modifiedAssetsUp,
        constants.assetCosts,
        constants,
        getMerchantPrice,
        selectedRevenueCase,
        false,
        includeTerminalValue
      );
      
      let modifiedIRRUp = 0;
      if (portfolioTotals?.equityCashFlows) {
        const individualAssets = Object.entries(modifiedMetricsUp)
          .filter(([assetName]) => assetName !== 'portfolio');
        
        const allEquityCashFlows = [];
        individualAssets.forEach(([_, metrics]) => {
          if (metrics.equityCashFlows && metrics.equityCashFlows.length > 0) {
            const truncatedCashFlows = metrics.equityCashFlows.slice(0, analysisYears + 1);
            
            if (allEquityCashFlows.length === 0) {
              allEquityCashFlows.push(...truncatedCashFlows.map(cf => cf));
            } else {
              truncatedCashFlows.forEach((cf, index) => {
                if (index < allEquityCashFlows.length) {
                  allEquityCashFlows[index] += cf;
                } else {
                  allEquityCashFlows.push(cf);
                }
              });
            }
          }
        });
        
        if (allEquityCashFlows.length > 0) {
          const irr = calculateIRR(allEquityCashFlows);
          modifiedIRRUp = irr ? irr * 100 : 0;
        }
      }
      
      const impactUp = modifiedIRRUp - baseIRRValue;
      results.upside = impactUp;
      console.log(`Volume +${range}% impact:`, impactUp);
      
      // Volume -range% (lower volume = lower IRR = downside)
      console.log(`Calculating -${range}% Volume scenario...`);
      
      const modifiedAssetsDown = JSON.parse(JSON.stringify(assets)); // Deep copy
      Object.keys(modifiedAssetsDown).forEach(key => {
        const asset = modifiedAssetsDown[key];
        
        // Modify capacity factors for renewables
        ['q1', 'q2', 'q3', 'q4'].forEach(quarter => {
          const factorKey = `qtrCapacityFactor_${quarter}`;
          if (asset[factorKey] && asset[factorKey] !== '') {
            asset[factorKey] = (parseFloat(asset[factorKey]) * (1 - range/100)).toString();
          }
        });
        
        // Modify volume for storage assets
        if (asset.type === 'storage' && asset.volume) {
          asset.volume = parseFloat(asset.volume) * (1 - range/100);
        }
        
        // Modify volumeLossAdjustment if present
        if (asset.volumeLossAdjustment) {
          const currentAdjustment = parseFloat(asset.volumeLossAdjustment);
          const newAdjustment = Math.max(0, currentAdjustment * (1 - range/100/2)); // Half the impact for loss adjustment
          asset.volumeLossAdjustment = newAdjustment.toString();
        }
      });
      
      const modifiedMetricsDown = calculateProjectMetrics(
        modifiedAssetsDown,
        constants.assetCosts,
        constants,
        getMerchantPrice,
        selectedRevenueCase,
        false,
        includeTerminalValue
      );
      
      let modifiedIRRDown = 0;
      if (portfolioTotals?.equityCashFlows) {
        const individualAssets = Object.entries(modifiedMetricsDown)
          .filter(([assetName]) => assetName !== 'portfolio');
        
        const allEquityCashFlows = [];
        individualAssets.forEach(([_, metrics]) => {
          if (metrics.equityCashFlows && metrics.equityCashFlows.length > 0) {
            const truncatedCashFlows = metrics.equityCashFlows.slice(0, analysisYears + 1);
            
            if (allEquityCashFlows.length === 0) {
              allEquityCashFlows.push(...truncatedCashFlows.map(cf => cf));
            } else {
              truncatedCashFlows.forEach((cf, index) => {
                if (index < allEquityCashFlows.length) {
                  allEquityCashFlows[index] += cf;
                } else {
                  allEquityCashFlows.push(cf);
                }
              });
            }
          }
        });
        
        if (allEquityCashFlows.length > 0) {
          const irr = calculateIRR(allEquityCashFlows);
          modifiedIRRDown = irr ? irr * 100 : 0;
        }
      }
      
      const impactDown = modifiedIRRDown - baseIRRValue;
      results.downside = impactDown;
      console.log(`Volume -${range}% impact:`, impactDown);
      
      return results;
      
    } catch (error) {
      console.error('Error calculating Volume sensitivity:', error);
      return { upside: 0, downside: 0 };
    }
  };

  // Calculate Interest Rate sensitivity
  const calculateInterestRateSensitivity = async (baseIRRValue) => {
    try {
      const { calculateProjectMetrics } = await import('@/app/components/ProjectFinance_Calcs');
      
      const results = { upside: 0, downside: 0 };
      
      // Interest Rate +1pp (higher interest = lower IRR = downside)
      console.log('Calculating +1pp Interest Rate scenario...');
      
      const modifiedConstantsUp = {
        ...constants,
        assetCosts: {}
      };
      
      Object.keys(constants.assetCosts || {}).forEach(key => {
        const originalData = constants.assetCosts[key] || {};
        const originalRate = originalData.interestRate || 0.06;
        
        modifiedConstantsUp.assetCosts[key] = {
          ...originalData,
          interestRate: originalRate + 0.01
        };
      });
      
      const modifiedMetricsUp = calculateProjectMetrics(
        assets,
        modifiedConstantsUp.assetCosts,
        modifiedConstantsUp,
        getMerchantPrice,
        selectedRevenueCase,
        false,
        includeTerminalValue
      );
      
      let modifiedIRRUp = 0;
      if (portfolioTotals?.equityCashFlows) {
        const individualAssets = Object.entries(modifiedMetricsUp)
          .filter(([assetName]) => assetName !== 'portfolio');
        
        const allEquityCashFlows = [];
        individualAssets.forEach(([_, metrics]) => {
          if (metrics.equityCashFlows && metrics.equityCashFlows.length > 0) {
            const truncatedCashFlows = metrics.equityCashFlows.slice(0, analysisYears + 1);
            
            if (allEquityCashFlows.length === 0) {
              allEquityCashFlows.push(...truncatedCashFlows.map(cf => cf));
            } else {
              truncatedCashFlows.forEach((cf, index) => {
                if (index < allEquityCashFlows.length) {
                  allEquityCashFlows[index] += cf;
                } else {
                  allEquityCashFlows.push(cf);
                }
              });
            }
          }
        });
        
        if (allEquityCashFlows.length > 0) {
          const irr = calculateIRR(allEquityCashFlows);
          modifiedIRRUp = irr ? irr * 100 : 0;
        }
      }
      
      const impactUp = modifiedIRRUp - baseIRRValue;
      results.downside = impactUp; // Higher interest rate = downside
      console.log('Interest Rate +1pp impact:', impactUp);
      
      // Interest Rate -1pp (lower interest = higher IRR = upside)
      console.log('Calculating -1pp Interest Rate scenario...');
      
      const modifiedConstantsDown = {
        ...constants,
        assetCosts: {}
      };
      
      Object.keys(constants.assetCosts || {}).forEach(key => {
        const originalData = constants.assetCosts[key] || {};
        const originalRate = originalData.interestRate || 0.06;
        
        modifiedConstantsDown.assetCosts[key] = {
          ...originalData,
          interestRate: Math.max(0.01, originalRate - 0.01)
        };
      });
      
      const modifiedMetricsDown = calculateProjectMetrics(
        assets,
        modifiedConstantsDown.assetCosts,
        modifiedConstantsDown,
        getMerchantPrice,
        selectedRevenueCase,
        false,
        includeTerminalValue
      );
      
      let modifiedIRRDown = 0;
      if (portfolioTotals?.equityCashFlows) {
        const individualAssets = Object.entries(modifiedMetricsDown)
          .filter(([assetName]) => assetName !== 'portfolio');
        
        const allEquityCashFlows = [];
        individualAssets.forEach(([_, metrics]) => {
          if (metrics.equityCashFlows && metrics.equityCashFlows.length > 0) {
            const truncatedCashFlows = metrics.equityCashFlows.slice(0, analysisYears + 1);
            
            if (allEquityCashFlows.length === 0) {
              allEquityCashFlows.push(...truncatedCashFlows.map(cf => cf));
            } else {
              truncatedCashFlows.forEach((cf, index) => {
                if (index < allEquityCashFlows.length) {
                  allEquityCashFlows[index] += cf;
                } else {
                  allEquityCashFlows.push(cf);
                }
              });
            }
          }
        });
        
        if (allEquityCashFlows.length > 0) {
          const irr = calculateIRR(allEquityCashFlows);
          modifiedIRRDown = irr ? irr * 100 : 0;
        }
      }
      
      const impactDown = modifiedIRRDown - baseIRRValue;
      results.upside = impactDown; // Lower interest rate = upside
      console.log('Interest Rate -1pp impact:', impactDown);
      
      return results;
      
    } catch (error) {
      console.error('Error calculating Interest Rate sensitivity:', error);
      return { upside: 0, downside: 0 };
    }
  };

  // Calculate OPEX sensitivity
  const calculateOpexSensitivity = async (baseIRRValue) => {
    try {
      const { calculateProjectMetrics } = await import('@/app/components/ProjectFinance_Calcs');
      
      const results = { upside: 0, downside: 0 };
      
      // OPEX +10% (higher OPEX = lower IRR = downside)
      console.log('Calculating +10% OPEX scenario...');
      
      const modifiedConstantsUp = {
        ...constants,
        assetCosts: {}
      };
      
      Object.keys(constants.assetCosts || {}).forEach(key => {
        const originalData = constants.assetCosts[key] || {};
        const originalOpex = originalData.operatingCosts || 0;
        
        modifiedConstantsUp.assetCosts[key] = {
          ...originalData,
          operatingCosts: originalOpex * 1.1
        };
      });
      
      const modifiedMetricsUp = calculateProjectMetrics(
        assets,
        modifiedConstantsUp.assetCosts,
        modifiedConstantsUp,
        getMerchantPrice,
        selectedRevenueCase,
        false,
        includeTerminalValue
      );
      
      let modifiedIRRUp = 0;
      if (portfolioTotals?.equityCashFlows) {
        const individualAssets = Object.entries(modifiedMetricsUp)
          .filter(([assetName]) => assetName !== 'portfolio');
        
        const allEquityCashFlows = [];
        individualAssets.forEach(([_, metrics]) => {
          if (metrics.equityCashFlows && metrics.equityCashFlows.length > 0) {
            const truncatedCashFlows = metrics.equityCashFlows.slice(0, analysisYears + 1);
            
            if (allEquityCashFlows.length === 0) {
              allEquityCashFlows.push(...truncatedCashFlows.map(cf => cf));
            } else {
              truncatedCashFlows.forEach((cf, index) => {
                if (index < allEquityCashFlows.length) {
                  allEquityCashFlows[index] += cf;
                } else {
                  allEquityCashFlows.push(cf);
                }
              });
            }
          }
        });
        
        if (allEquityCashFlows.length > 0) {
          const irr = calculateIRR(allEquityCashFlows);
          modifiedIRRUp = irr ? irr * 100 : 0;
        }
      }
      
      const impactUp = modifiedIRRUp - baseIRRValue;
      results.downside = impactUp; // Higher OPEX = downside
      console.log('OPEX +10% impact:', impactUp);
      
      // OPEX -10% (lower OPEX = higher IRR = upside)
      console.log('Calculating -10% OPEX scenario...');
      
      const modifiedConstantsDown = {
        ...constants,
        assetCosts: {}
      };
      
      Object.keys(constants.assetCosts || {}).forEach(key => {
        const originalData = constants.assetCosts[key] || {};
        const originalOpex = originalData.operatingCosts || 0;
        
        modifiedConstantsDown.assetCosts[key] = {
          ...originalData,
          operatingCosts: originalOpex * 0.9
        };
      });
      
      const modifiedMetricsDown = calculateProjectMetrics(
        assets,
        modifiedConstantsDown.assetCosts,
        modifiedConstantsDown,
        getMerchantPrice,
        selectedRevenueCase,
        false,
        includeTerminalValue
      );
      
      let modifiedIRRDown = 0;
      if (portfolioTotals?.equityCashFlows) {
        const individualAssets = Object.entries(modifiedMetricsDown)
          .filter(([assetName]) => assetName !== 'portfolio');
        
        const allEquityCashFlows = [];
        individualAssets.forEach(([_, metrics]) => {
          if (metrics.equityCashFlows && metrics.equityCashFlows.length > 0) {
            const truncatedCashFlows = metrics.equityCashFlows.slice(0, analysisYears + 1);
            
            if (allEquityCashFlows.length === 0) {
              allEquityCashFlows.push(...truncatedCashFlows.map(cf => cf));
            } else {
              truncatedCashFlows.forEach((cf, index) => {
                if (index < allEquityCashFlows.length) {
                  allEquityCashFlows[index] += cf;
                } else {
                  allEquityCashFlows.push(cf);
                }
              });
            }
          }
        });
        
        if (allEquityCashFlows.length > 0) {
          const irr = calculateIRR(allEquityCashFlows);
          modifiedIRRDown = irr ? irr * 100 : 0;
        }
      }
      
      const impactDown = modifiedIRRDown - baseIRRValue;
      results.upside = impactDown; // Lower OPEX = upside
      console.log('OPEX -10% impact:', impactDown);
      
      return results;
      
    } catch (error) {
      console.error('Error calculating OPEX sensitivity:', error);
      return { upside: 0, downside: 0 };
    }
  };

  // Calculate Terminal Value sensitivity
  const calculateTerminalValueSensitivity = async (baseIRRValue) => {
    try {
      const { calculateProjectMetrics } = await import('@/app/components/ProjectFinance_Calcs');
      
      const results = { upside: 0, downside: 0 };
      
      // Terminal Value +50% (higher terminal value = higher IRR = upside)
      console.log('Calculating +50% Terminal Value scenario...');
      
      const modifiedConstantsUp = {
        ...constants,
        assetCosts: {}
      };
      
      Object.keys(constants.assetCosts || {}).forEach(key => {
        const originalData = constants.assetCosts[key] || {};
        const originalTerminal = originalData.terminalValue || 0;
        
        modifiedConstantsUp.assetCosts[key] = {
          ...originalData,
          terminalValue: originalTerminal * 1.5
        };
      });
      
      const modifiedMetricsUp = calculateProjectMetrics(
        assets,
        modifiedConstantsUp.assetCosts,
        modifiedConstantsUp,
        getMerchantPrice,
        selectedRevenueCase,
        false,
        includeTerminalValue
      );
      
      let modifiedIRRUp = 0;
      if (portfolioTotals?.equityCashFlows) {
        const individualAssets = Object.entries(modifiedMetricsUp)
          .filter(([assetName]) => assetName !== 'portfolio');
        
        const allEquityCashFlows = [];
        individualAssets.forEach(([_, metrics]) => {
          if (metrics.equityCashFlows && metrics.equityCashFlows.length > 0) {
            const truncatedCashFlows = metrics.equityCashFlows.slice(0, analysisYears + 1);
            
            if (allEquityCashFlows.length === 0) {
              allEquityCashFlows.push(...truncatedCashFlows.map(cf => cf));
            } else {
              truncatedCashFlows.forEach((cf, index) => {
                if (index < allEquityCashFlows.length) {
                  allEquityCashFlows[index] += cf;
                } else {
                  allEquityCashFlows.push(cf);
                }
              });
            }
          }
        });
        
        if (allEquityCashFlows.length > 0) {
          const irr = calculateIRR(allEquityCashFlows);
          modifiedIRRUp = irr ? irr * 100 : 0;
        }
      }
      
      const impactUp = modifiedIRRUp - baseIRRValue;
      results.upside = impactUp;
      console.log('Terminal Value +50% impact:', impactUp);
      
      // Terminal Value -50% (lower terminal value = lower IRR = downside)
      console.log('Calculating -50% Terminal Value scenario...');
      
      const modifiedConstantsDown = {
        ...constants,
        assetCosts: {}
      };
      
      Object.keys(constants.assetCosts || {}).forEach(key => {
        const originalData = constants.assetCosts[key] || {};
        const originalTerminal = originalData.terminalValue || 0;
        
        modifiedConstantsDown.assetCosts[key] = {
          ...originalData,
          terminalValue: originalTerminal * 0.5
        };
      });
      
      const modifiedMetricsDown = calculateProjectMetrics(
        assets,
        modifiedConstantsDown.assetCosts,
        modifiedConstantsDown,
        getMerchantPrice,
        selectedRevenueCase,
        false,
        includeTerminalValue
      );
      
      let modifiedIRRDown = 0;
      if (portfolioTotals?.equityCashFlows) {
        const individualAssets = Object.entries(modifiedMetricsDown)
          .filter(([assetName]) => assetName !== 'portfolio');
        
        const allEquityCashFlows = [];
        individualAssets.forEach(([_, metrics]) => {
          if (metrics.equityCashFlows && metrics.equityCashFlows.length > 0) {
            const truncatedCashFlows = metrics.equityCashFlows.slice(0, analysisYears + 1);
            
            if (allEquityCashFlows.length === 0) {
              allEquityCashFlows.push(...truncatedCashFlows.map(cf => cf));
            } else {
              truncatedCashFlows.forEach((cf, index) => {
                if (index < allEquityCashFlows.length) {
                  allEquityCashFlows[index] += cf;
                } else {
                  allEquityCashFlows.push(cf);
                }
              });
            }
          }
        });
        
        if (allEquityCashFlows.length > 0) {
          const irr = calculateIRR(allEquityCashFlows);
          modifiedIRRDown = irr ? irr * 100 : 0;
        }
      }
      
      const impactDown = modifiedIRRDown - baseIRRValue;
      results.downside = impactDown;
      console.log('Terminal Value -50% impact:', impactDown);
      
      return results;
      
    } catch (error) {
      console.error('Error calculating Terminal Value sensitivity:', error);
      return { upside: 0, downside: 0 };
    }
  };
  const calculateCapexSensitivity = async (baseIRRValue) => {
    try {
      const { calculateProjectMetrics } = await import('@/app/components/ProjectFinance_Calcs');
      
      const results = { upside: 0, downside: 0 };
      
      // CAPEX +10% (higher CAPEX = lower IRR = downside)
      const modifiedConstantsUp = {
        ...constants,
        assetCosts: {}
      };
      
      // Safely modify each asset's CAPEX
      Object.keys(constants.assetCosts || {}).forEach(key => {
        const originalData = constants.assetCosts[key] || {};
        const originalCapex = originalData.capex || 0;
        
        modifiedConstantsUp.assetCosts[key] = {
          ...originalData,
          capex: originalCapex * 1.1
        };
      });
      
      console.log('Calculating +10% CAPEX scenario...');
      
      const modifiedMetricsUp = calculateProjectMetrics(
        assets,
        modifiedConstantsUp.assetCosts,
        modifiedConstantsUp,
        getMerchantPrice,
        selectedRevenueCase,
        false,
        includeTerminalValue
      );
      
      // Calculate new IRR using same method as base
      let modifiedIRRUp = 0;
      if (portfolioTotals?.equityCashFlows) {
        // Recalculate portfolio totals
        const individualAssets = Object.entries(modifiedMetricsUp)
          .filter(([assetName]) => assetName !== 'portfolio');
        
        const allEquityCashFlows = [];
        individualAssets.forEach(([_, metrics]) => {
          if (metrics.equityCashFlows && metrics.equityCashFlows.length > 0) {
            const truncatedCashFlows = metrics.equityCashFlows.slice(0, analysisYears + 1);
            
            if (allEquityCashFlows.length === 0) {
              allEquityCashFlows.push(...truncatedCashFlows.map(cf => cf));
            } else {
              truncatedCashFlows.forEach((cf, index) => {
                if (index < allEquityCashFlows.length) {
                  allEquityCashFlows[index] += cf;
                } else {
                  allEquityCashFlows.push(cf);
                }
              });
            }
          }
        });
        
        if (allEquityCashFlows.length > 0) {
          const irr = calculateIRR(allEquityCashFlows);
          modifiedIRRUp = irr ? irr * 100 : 0;
        }
      }
      
      const impactUp = modifiedIRRUp - baseIRRValue;
      results.downside = impactUp;
      
      console.log('CAPEX +10% impact:', impactUp);
      
      // CAPEX -10% (lower CAPEX = higher IRR = upside)
      const modifiedConstantsDown = {
        ...constants,
        assetCosts: {}
      };
      
      Object.keys(constants.assetCosts || {}).forEach(key => {
        const originalData = constants.assetCosts[key] || {};
        const originalCapex = originalData.capex || 0;
        
        modifiedConstantsDown.assetCosts[key] = {
          ...originalData,
          capex: originalCapex * 0.9
        };
      });
      
      console.log('Calculating -10% CAPEX scenario...');
      
      const modifiedMetricsDown = calculateProjectMetrics(
        assets,
        modifiedConstantsDown.assetCosts,
        modifiedConstantsDown,
        getMerchantPrice,
        selectedRevenueCase,
        false,
        includeTerminalValue
      );
      
      // Calculate new IRR
      let modifiedIRRDown = 0;
      if (portfolioTotals?.equityCashFlows) {
        const individualAssets = Object.entries(modifiedMetricsDown)
          .filter(([assetName]) => assetName !== 'portfolio');
        
        const allEquityCashFlows = [];
        individualAssets.forEach(([_, metrics]) => {
          if (metrics.equityCashFlows && metrics.equityCashFlows.length > 0) {
            const truncatedCashFlows = metrics.equityCashFlows.slice(0, analysisYears + 1);
            
            if (allEquityCashFlows.length === 0) {
              allEquityCashFlows.push(...truncatedCashFlows.map(cf => cf));
            } else {
              truncatedCashFlows.forEach((cf, index) => {
                if (index < allEquityCashFlows.length) {
                  allEquityCashFlows[index] += cf;
                } else {
                  allEquityCashFlows.push(cf);
                }
              });
            }
          }
        });
        
        if (allEquityCashFlows.length > 0) {
          const irr = calculateIRR(allEquityCashFlows);
          modifiedIRRDown = irr ? irr * 100 : 0;
        }
      }
      
      const impactDown = modifiedIRRDown - baseIRRValue;
      results.upside = impactDown;
      
      console.log('CAPEX -10% impact:', impactDown);
      
      return results;
      
    } catch (error) {
      console.error('Error calculating CAPEX sensitivity:', error);
      return { upside: 0, downside: 0 };
    }
  };

  // Main calculation function
  const calculateSensitivity = async () => {
    if (!constants.assetCosts || Object.keys(assets).length === 0) {
      console.log('Missing required data for sensitivity analysis');
      setSensitivityData([]);
      return;
    }

    setCalculating(true);
    
    try {
      // Get base IRR
      const baseIRRValue = getBaseIRR();
      setBaseIRR(baseIRRValue);
      
      if (baseIRRValue <= 0) {
        console.log('Invalid base IRR:', baseIRRValue);
        setSensitivityData([]);
        setCalculating(false);
        return;
      }
      
      console.log('Starting sensitivity analysis with base IRR:', baseIRRValue);
      
      // Calculate all sensitivities
      const capexResults = await calculateCapexSensitivity(baseIRRValue);
      const electricityResults = await calculateElectricityPriceSensitivity(baseIRRValue);
      const volumeResults = await calculateVolumeSensitivity(baseIRRValue);
      const interestResults = await calculateInterestRateSensitivity(baseIRRValue);
      const opexResults = await calculateOpexSensitivity(baseIRRValue);
      const terminalResults = await calculateTerminalValueSensitivity(baseIRRValue);
      
      // Build results array
      const results = [
        {
          parameter: 'CAPEX',
          upside: capexResults.upside,
          downside: capexResults.downside,
          baseIRR: baseIRRValue,
          maxAbsImpact: Math.max(Math.abs(capexResults.upside), Math.abs(capexResults.downside)),
          isLive: true,
          range: ranges.capex,
          unit: '%'
        },
        {
          parameter: 'Electricity Price',
          upside: electricityResults.upside,
          downside: electricityResults.downside,
          baseIRR: baseIRRValue,
          maxAbsImpact: Math.max(Math.abs(electricityResults.upside), Math.abs(electricityResults.downside)),
          isLive: true,
          range: ranges.electricityPrice,
          unit: '%'
        },
        {
          parameter: 'Volume',
          upside: volumeResults.upside,
          downside: volumeResults.downside,
          baseIRR: baseIRRValue,
          maxAbsImpact: Math.max(Math.abs(volumeResults.upside), Math.abs(volumeResults.downside)),
          isLive: true,
          range: ranges.volume,
          unit: '%'
        },
        {
          parameter: 'Interest Rate',
          upside: interestResults.upside,
          downside: interestResults.downside,
          baseIRR: baseIRRValue,
          maxAbsImpact: Math.max(Math.abs(interestResults.upside), Math.abs(interestResults.downside)),
          isLive: true,
          range: ranges.interestRate,
          unit: 'pp'
        },
        {
          parameter: 'OPEX',
          upside: opexResults.upside,
          downside: opexResults.downside,
          baseIRR: baseIRRValue,
          maxAbsImpact: Math.max(Math.abs(opexResults.upside), Math.abs(opexResults.downside)),
          isLive: true,
          range: ranges.opex,
          unit: '%'
        },
        {
          parameter: 'Terminal Value',
          upside: terminalResults.upside,
          downside: terminalResults.downside,
          baseIRR: baseIRRValue,
          maxAbsImpact: Math.max(Math.abs(terminalResults.upside), Math.abs(terminalResults.downside)),
          isLive: true,
          range: ranges.terminalValue,
          unit: '%'
        }
      ];
      
      // Sort by impact
      const sortedResults = results.sort((a, b) => b.maxAbsImpact - a.maxAbsImpact);
      
      console.log('Sensitivity analysis complete:', sortedResults);
      setSensitivityData(sortedResults);
      
    } catch (error) {
      console.error('Error in sensitivity analysis:', error);
      setSensitivityData([]);
    } finally {
      setCalculating(false);
    }
  };

  // Run calculation when inputs change
  useEffect(() => {
    if (Object.keys(projectMetrics).length > 0 && Object.keys(assets).length > 0 && constants.assetCosts) {
      calculateSensitivity();
    }
  }, [projectMetrics, assets, constants, analysisYears, selectedRevenueCase, includeTerminalValue, portfolioTotals, ranges]);

  // Loading state
  if (calculating) {
    return (
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">IRR Sensitivity Analysis</h3>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
          <span className="text-gray-600">Calculating sensitivity analysis...</span>
        </div>
      </div>
    );
  }

  // No data state
  if (sensitivityData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">IRR Sensitivity Analysis</h3>
        <div className="text-center text-gray-500 py-12">
          <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No sensitivity data available</p>
          <p className="text-sm">Check that portfolio analysis is complete</p>
        </div>
      </div>
    );
  }

  // Main display
  return (
    <div className="bg-white rounded-lg shadow border p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Table className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold">
          {analysisYears}-Year IRR Sensitivity Analysis
        </h3>
      </div>
      
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Base Portfolio IRR:</strong> {baseIRR.toFixed(2)}% • 
          <strong>Analysis Period:</strong> {analysisYears} years • 
          <strong>Status:</strong> All parameters calculated live • 
          <strong>Scenarios:</strong> ±10% for most, ±1pp for interest, ±50% for terminal
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-900">Parameter</th>
              <th className="text-center py-3 px-4 font-medium text-gray-900">Range</th>
              <th className="text-center py-3 px-4 font-medium text-gray-900">Base IRR</th>
              <th className="text-center py-3 px-4 font-medium text-gray-900">Downside</th>
              <th className="text-center py-3 px-4 font-medium text-gray-900">Upside</th>
              <th className="text-center py-3 px-4 font-medium text-gray-900">Total Range</th>
              <th className="text-center py-3 px-4 font-medium text-gray-900">Status</th>
            </tr>
          </thead>
          <tbody>
            {sensitivityData.map((item, index) => {
              const parameterKey = item.parameter.toLowerCase().replace(' ', '');
              const rangeKey = parameterKey === 'electricityprice' ? 'electricityPrice' : 
                              parameterKey === 'interestrate' ? 'interestRate' : 
                              parameterKey === 'terminalvalue' ? 'terminalValue' : parameterKey;
              
              return (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{item.parameter}</td>
                  <td className="text-center py-3 px-4">
                    <div className="flex items-center justify-center space-x-1">
                      <span>±</span>
                      <input
                        type="number"
                        value={item.range}
                        onChange={(e) => updateRange(rangeKey, e.target.value)}
                        className="w-16 px-2 py-1 text-xs border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="0.1"
                        max="100"
                        step="0.1"
                      />
                      <span className="text-xs text-gray-500">{item.unit}</span>
                    </div>
                  </td>
                  <td className="text-center py-3 px-4 text-gray-700">{item.baseIRR.toFixed(2)}%</td>
                  <td className={`text-center py-3 px-4 font-medium ${
                    item.downside < 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {item.downside > 0 ? '+' : ''}{item.downside.toFixed(2)}pp
                  </td>
                  <td className={`text-center py-3 px-4 font-medium ${
                    item.upside > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {item.upside > 0 ? '+' : ''}{item.upside.toFixed(2)}pp
                  </td>
                  <td className="text-center py-3 px-4 text-gray-700 font-medium">
                    {(Math.abs(item.upside) + Math.abs(item.downside)).toFixed(2)}pp
                  </td>
                  <td className="text-center py-3 px-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      item.isLive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {item.isLive ? 'Live' : 'Static'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p>
          <strong>Live Sensitivity Analysis:</strong> All parameters recalculate project metrics with the specified changes:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div>
            <ul className="text-xs space-y-1">
              <li>• <strong>CAPEX:</strong> ±10% modification to asset costs</li>
              <li>• <strong>Electricity Price:</strong> ±10% to all merchant prices</li>
              <li>• <strong>Capacity Factor:</strong> ±10% to all quarterly capacity factors</li>
            </ul>
          </div>
          <div>
            <ul className="text-xs space-y-1">
              <li>• <strong>Interest Rate:</strong> ±1 percentage point to debt rates</li>
              <li>• <strong>OPEX:</strong> ±10% to operating costs</li>
              <li>• <strong>Terminal Value:</strong> ±50% to end-of-life asset values</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}