// app/contexts/MerchantPriceProvider.jsx
// Updated to include escalation settings management
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import Papa from 'papaparse';
import _ from 'lodash';
import { DEFAULT_DATA_SOURCES } from '@/lib/default_constants';

const getQuarterFromDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    // Handle DD/MM/YYYY format
    const [day, month, year] = dateStr.split('/');
    return Math.ceil(parseInt(month) / 3);
  } catch (error) {
    console.warn('Error extracting quarter from date:', dateStr, error);
    return null;
  }
};

const MerchantPriceContext = createContext();

export function useMerchantPrices() {
  const context = useContext(MerchantPriceContext);
  if (!context) {
    throw new Error('useMerchantPrices must be used within a MerchantPriceProvider');
  }
  return context;
}

export function MerchantPriceProvider({ children }) {
  const [priceSource, setPriceSource] = useState(DEFAULT_DATA_SOURCES.priceCurveSource);
  const [spreadSource, setSpreadSource] = useState('merchant_yearly_spreads.csv');
  const [spreadData, setSpreadData] = useState({});
  
  // NEW: Escalation settings that can be configured
  const [escalationSettings, setEscalationSettings] = useState({
    enabled: true,
    rate: 2.5,          // % per annum
    referenceYear: 2025,
    applyToStorage: true,
    applyToRenewables: true
  });
  
  const [priceData, setPriceData] = useState({
    monthly: {
      solar: { Energy: {}, green: {} },
      wind: { Energy: {}, green: {} },
      baseload: { Energy: {}, green: {} }
    },
    yearly: {
      solar: { Energy: {}, green: {} },
      wind: { Energy: {}, green: {} },
      baseload: { Energy: {}, green: {} }
    },
    quarterly: {
      solar: { Energy: {}, green: {} },
      wind: { Energy: {}, green: {} },
      baseload: { Energy: {}, green: {} }
    }
  });

  // Apply escalation to a base price
  const applyEscalation = useCallback((basePrice, year) => {
    if (!escalationSettings.enabled || !basePrice) return basePrice;
    
    const yearDiff = year - escalationSettings.referenceYear;
    return basePrice * Math.pow(1 + escalationSettings.rate / 100, yearDiff);
  }, [escalationSettings]);

  const aggregateData = (monthlyData) => {
    const aggregated = {
      monthly: monthlyData,
      yearly: {
        solar: { Energy: {}, green: {} },
        wind: { Energy: {}, green: {} },
        baseload: { Energy: {}, green: {} }
      },
      quarterly: {
        solar: { Energy: {}, green: {} },
        wind: { Energy: {}, green: {} },
        baseload: { Energy: {}, green: {} }
      }
    };

    Object.entries(monthlyData).forEach(([profile, profileData]) => {
      Object.entries(profileData).forEach(([type, typeData]) => {
        Object.entries(typeData).forEach(([state, stateData]) => {
          Object.entries(stateData).forEach(([time, data]) => {
            // Handle DD/MM/YYYY format
            const [day, month, year] = time.split('/');
            const quarter = getQuarterFromDate(time);
            const yearKey = year.toString();
            const quarterKey = `${yearKey}-Q${quarter}`;

            if (!aggregated.yearly[profile][type][state]) {
              aggregated.yearly[profile][type][state] = {};
            }
            if (!aggregated.quarterly[profile][type][state]) {
              aggregated.quarterly[profile][type][state] = {};
            }
            if (!aggregated.yearly[profile][type][state][yearKey]) {
              aggregated.yearly[profile][type][state][yearKey] = [];
            }
            if (!aggregated.quarterly[profile][type][state][quarterKey]) {
              aggregated.quarterly[profile][type][state][quarterKey] = [];
            }

            aggregated.yearly[profile][type][state][yearKey].push(data.price);
            aggregated.quarterly[profile][type][state][quarterKey].push(data.price);
          });
        });
      });
    });

    ['yearly', 'quarterly'].forEach(period => {
      Object.entries(aggregated[period]).forEach(([profile, profileData]) => {
        Object.entries(profileData).forEach(([type, typeData]) => {
          Object.entries(typeData).forEach(([state, periodData]) => {
            Object.entries(periodData).forEach(([key, prices]) => {
              aggregated[period][profile][type][state][key] = _.mean(prices);
            });
          });
        });
      });
    });

    return aggregated;
  };

  const setMerchantPrices = useCallback((data) => {
    const monthlyData = {
      solar: { Energy: {}, green: {} },
      wind: { Energy: {}, green: {} },
      baseload: { Energy: {}, green: {} }
    };

    data.forEach(row => {
      if (!monthlyData[row.profile][row.type][row.state]) {
        monthlyData[row.profile][row.type][row.state] = {};
      }
      monthlyData[row.profile][row.type][row.state][row.time] = {
        price: row.price,
        source: row.source || 'imported'
      };
    });

    const aggregatedData = aggregateData(monthlyData);
    setPriceData(aggregatedData);
    setPriceSource('imported');
  }, []);

  const processCSVData = useCallback((results) => {
    if (!results.data || results.data.length === 0) {
      console.error('No data found in merchant prices CSV');
      return;
    }

    const monthlyData = {
      solar: { Energy: {}, green: {} },
      wind: { Energy: {}, green: {} },
      baseload: { Energy: {}, green: {} }
    };

    results.data.forEach(row => {
      if (!row.profile || !row.type || !row.state || !row.time || row.price === undefined) {
        return;
      }

      if (!monthlyData[row.profile][row.type][row.state]) {
        monthlyData[row.profile][row.type][row.state] = {};
      }

      monthlyData[row.profile][row.type][row.state][row.time] = {
        price: row.price,
        source: 'default'
      };
    });

    const aggregatedData = aggregateData(monthlyData);
    setPriceData(aggregatedData);
  }, []);

  useEffect(() => {
    const loadSpreadData = async () => {
      try {
        const response = await fetch(`/${spreadSource}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        
        Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (!results.data || results.data.length === 0) {
              console.error('No data found in merchant spreads CSV');
              return;
            }

            const spreads = {};
            results.data.forEach(row => {
              if (!spreads[row.REGION]) {
                spreads[row.REGION] = {};
              }
              if (!spreads[row.REGION][row.DURATION]) {
                spreads[row.REGION][row.DURATION] = {};
              }
              spreads[row.REGION][row.DURATION][row.YEAR] = row.SPREAD;
            });
            
            setSpreadData(spreads);
            console.log('Loaded spread data:', spreads);
          }
        });
      } catch (error) {
        console.error('Error loading merchant spreads:', error);
      }
    };

    loadSpreadData();
  }, [spreadSource]);

  useEffect(() => {
    const loadMerchantPrices = async () => {
      try {
        if (priceSource === 'imported') {
          return;
        }

        const response = await fetch(`/${priceSource}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        
        Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: processCSVData
        });
      } catch (error) {
        console.error('Error loading merchant prices:', error);
      }
    };

    loadMerchantPrices();
  }, [priceSource, processCSVData]);

  const getMerchantPrice = useCallback((profile, type, region, timeStr) => {
    try {
      console.log(`getMerchantPrice called: profile=${profile}, type=${type}, region=${region}, time=${timeStr}`);
      
      let basePrice = 0;
      let targetYear = new Date().getFullYear(); // Default year for escalation
      
      if (profile === 'storage') {
        // For storage, extract year from timeStr and use type as duration
        if (typeof timeStr === 'number') {
          targetYear = timeStr;
        } else if (typeof timeStr === 'string') {
          if (timeStr.includes('/')) {
            // DD/MM/YYYY format
            const [day, month, yearPart] = timeStr.split('/');
            targetYear = parseInt(yearPart);
          } else if (timeStr.includes('-Q')) {
            // Quarterly format like "2025-Q1"
            targetYear = parseInt(timeStr.split('-')[0]);
          } else {
            // Assume it's just a year
            targetYear = parseInt(timeStr);
          }
        }
        
        // Try to get spread from data, but extend to all years if not available
        let spread = spreadData[region]?.[type]?.[targetYear];
        
        if (!spread) {
          // If no data for this year, try to find the closest available year
          const availableYears = Object.keys(spreadData[region]?.[type] || {}).map(y => parseInt(y)).sort();
          
          if (availableYears.length > 0) {
            if (targetYear <= Math.min(...availableYears)) {
              // Use earliest year if target is before data range
              spread = spreadData[region]?.[type]?.[availableYears[0]];
            } else if (targetYear >= Math.max(...availableYears)) {
              // Use latest year if target is after data range
              spread = spreadData[region]?.[type]?.[availableYears[availableYears.length - 1]];
            } else {
              // Use closest year for years in between
              const closest = availableYears.reduce((prev, curr) => 
                Math.abs(curr - targetYear) < Math.abs(prev - targetYear) ? curr : prev
              );
              spread = spreadData[region]?.[type]?.[closest];
            }
          }
        }
        
        // Fallback to default if still no spread found
        basePrice = spread ?? 160;
        
        // Apply escalation if enabled for storage
        if (escalationSettings.enabled && escalationSettings.applyToStorage) {
          basePrice = applyEscalation(basePrice, targetYear);
        }
        
        console.log(`Storage price lookup: region=${region}, duration=${type}, year=${targetYear}, basePrice=${spread ?? 160}, escalatedPrice=${basePrice}`);
        return basePrice;
      }
      
      // For non-storage profiles, extract year for escalation
      if (typeof timeStr === 'number' || (!timeStr.includes('/') && !timeStr.includes('-'))) {
        targetYear = parseInt(timeStr.toString());
        basePrice = priceData.yearly[profile]?.[type]?.[region]?.[targetYear] || 0;
      } else if (timeStr.includes('-Q')) {
        targetYear = parseInt(timeStr.split('-')[0]);
        basePrice = priceData.quarterly[profile]?.[type]?.[region]?.[timeStr] || 0;
      } else if (timeStr.includes('/')) {
        // Monthly lookup with DD/MM/YYYY format
        const [day, month, year] = timeStr.split('/');
        targetYear = parseInt(year);
        basePrice = priceData.monthly[profile]?.[type]?.[region]?.[timeStr]?.price || 0;
      }
      
      // Apply escalation if enabled for renewables
      if (escalationSettings.enabled && escalationSettings.applyToRenewables && basePrice > 0) {
        const escalatedPrice = applyEscalation(basePrice, targetYear);
        console.log(`Renewable price lookup: basePrice=${basePrice}, year=${targetYear}, escalatedPrice=${escalatedPrice}`);
        return escalatedPrice;
      }
      
      console.log(`Price lookup (no escalation): ${basePrice}`);
      return basePrice;
    } catch (error) {
      console.warn(`Error getting merchant price for profile=${profile}, type=${type}, region=${region}, time=${timeStr}`, error);
      return profile === 'storage' ? 160 : 0;
    }
  }, [priceData, spreadData, escalationSettings, applyEscalation]);

  // NEW: Function to update escalation settings
  const updateEscalationSettings = useCallback((newSettings) => {
    setEscalationSettings(prev => ({
      ...prev,
      ...newSettings
    }));
  }, []);

  // NEW: Function to reset escalation to defaults
  const resetEscalationSettings = useCallback(() => {
    setEscalationSettings({
      enabled: true,
      rate: 2.5,
      referenceYear: 2025,
      applyToStorage: true,
      applyToRenewables: true
    });
  }, []);

  const value = {
    merchantPrices: priceData.monthly,
    getMerchantPrice,
    priceSource,
    setPriceSource,
    setMerchantPrices,
    spreadSource, 
    setSpreadSource,
    
    // NEW: Escalation settings
    escalationSettings,
    updateEscalationSettings,
    resetEscalationSettings,
    applyEscalation
  };

  return (
    <MerchantPriceContext.Provider value={value}>
      {children}
    </MerchantPriceContext.Provider>
  );
}

export default MerchantPriceProvider;