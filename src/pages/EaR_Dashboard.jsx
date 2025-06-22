import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { useEarAnalysis } from '@/components/EarCalculations';
import EarInputs from '@/components/EarInputs';
import EarOutputs from '@/components/EarOutputs';

const createInitialTimePeriods = (constants) => {
  const midYear = Math.floor((constants.analysisEndYear - constants.analysisStartYear) / 2) + constants.analysisStartYear;
  return [
    {
      startYear: constants.analysisStartYear,
      endYear: midYear,
      volumeVariation: constants.volumeVariation,
      EnergyPriceVariation: constants.EnergyPriceVariation,
      greenPriceVariation: constants.greenPriceVariation,
    },
    {
      startYear: midYear + 1,
      endYear: constants.analysisEndYear,
      volumeVariation: constants.volumeVariation,
      EnergyPriceVariation: constants.EnergyPriceVariation,
      greenPriceVariation: constants.greenPriceVariation,
    }
  ];
};

const EarningsRiskAnalysis = () => {
  const { 
    assets, 
    constants, 
    updateConstants, 
    getMerchantPrice,
    analysisMode,
    updateAnalysisMode 
  } = usePortfolio();
  
  const [selectedYear, setSelectedYear] = useState(() => {
    const earliestAssetStart = Math.min(...Object.values(assets).map(asset => 
      asset.assetStartDate ? new Date(asset.assetStartDate).getFullYear() : Infinity
    ));
    return Math.max(constants.analysisStartYear, earliestAssetStart === Infinity ? constants.analysisStartYear : earliestAssetStart);
  });
  
  // Initialize timePeriods with stored value or create default if in complex mode
  const [timePeriods, setTimePeriods] = useState(() => {
    if (analysisMode === 'complex') {
      const savedPeriods = sessionStorage.getItem('timePeriods');
      return savedPeriods ? JSON.parse(savedPeriods) : createInitialTimePeriods(constants);
    }
    return null;
  });

  // Handle mode changes and ensure timePeriods are properly initialized
  useEffect(() => {
    if (analysisMode === 'complex') {
      const savedPeriods = sessionStorage.getItem('timePeriods');
      if (savedPeriods) {
        setTimePeriods(JSON.parse(savedPeriods));
      } else if (!timePeriods) {
        const initialPeriods = createInitialTimePeriods(constants);
        setTimePeriods(initialPeriods);
        sessionStorage.setItem('timePeriods', JSON.stringify(initialPeriods));
      }
    } else {
      setTimePeriods(null);
      sessionStorage.removeItem('timePeriods');
    }
  }, [analysisMode, constants]);

  // Handle time period changes from EarInputs
  const handleTimePeriodsChange = useCallback((newPeriods) => {
    setTimePeriods(newPeriods);
    if (newPeriods) {
      sessionStorage.setItem('timePeriods', JSON.stringify(newPeriods));
    } else {
      sessionStorage.removeItem('timePeriods');
    }
  }, []);
  
  const { getYearlyAnalysis, isCalculating, error, hasScenarios } = useEarAnalysis(
    assets, 
    constants, 
    getMerchantPrice,
    timePeriods
  );

  // Memoize the analysis for the selected year
  const yearlyAnalysis = useMemo(() => {
    if (!hasScenarios) return null;
    return getYearlyAnalysis(selectedYear);
  }, [
    hasScenarios,
    getYearlyAnalysis,
    selectedYear,
    timePeriods
  ]);

  // Memoize waterfall data
  const waterfallData = useMemo(() => {
    if (!hasScenarios) return [];
    
    return Array.from(
      { length: constants.analysisEndYear - constants.analysisStartYear + 1 },
      (_, i) => {
        const year = constants.analysisStartYear + i;
        const yearAnalysis = getYearlyAnalysis(year);
        if (!yearAnalysis) return null;
        
        const { metrics } = yearAnalysis;
        return {
          year,
          baseCase: metrics.baseCase,
          p10: metrics.p10,
          p90: metrics.p90,
          worstCase: metrics.stressTests.worstCase,
          volumeStress: metrics.stressTests.volumeStress,
          priceStress: metrics.stressTests.priceStress
        };
      }
    ).filter(Boolean);
  }, [
    hasScenarios,
    getYearlyAnalysis,
    constants.analysisStartYear,
    constants.analysisEndYear,
    timePeriods
  ]);

  // Memoized callback for year changes
  const handleYearChange = useCallback((year) => {
    setSelectedYear(year);
  }, []);

  if (!assets || Object.keys(assets).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-gray-500">
        <p className="text-lg font-medium">No Assets Available</p>
        <p className="text-sm">Add assets to view risk analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <EarInputs 
        constants={constants} 
        updateConstants={updateConstants}
        onTimePeriodsChange={handleTimePeriodsChange}
        mode={analysisMode}
        setMode={updateAnalysisMode}
        timePeriods={timePeriods}
      />
      
      <EarOutputs
        yearlyAnalysis={yearlyAnalysis}
        waterfallData={waterfallData}
        selectedYear={selectedYear}
        onYearChange={handleYearChange}
        constants={constants}
        isCalculating={isCalculating}
        error={error}
      />
    </div>
  );
};

export default EarningsRiskAnalysis;