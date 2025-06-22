// MerchantPriceProvider.jsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import Papa from 'papaparse';
import _ from 'lodash';
import { DEFAULT_DATA_SOURCES } from '../lib/default_constants';

const getQuarterFromDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const [, month] = dateStr.split('/');
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
            const [, , year] = time.split('/');
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
      if (profile === 'storage') {
        if (typeof timeStr === 'number') timeStr = timeStr.toString();
        const spread = spreadData[region]?.[type]?.[timeStr] ?? 160;
        return spread;
      }
      
      if (typeof timeStr === 'number' || (!timeStr.includes('/') && !timeStr.includes('-'))) {
        const yearKey = timeStr.toString();
        return priceData.yearly[profile]?.[type]?.[region]?.[yearKey] || 0;
      }
      
      if (timeStr.includes('-Q')) {
        return priceData.quarterly[profile]?.[type]?.[region]?.[timeStr] || 0;
      }
      
      return priceData.monthly[profile]?.[type]?.[region]?.[timeStr]?.price || 0;
    } catch (error) {
      console.warn(`Error getting merchant price for profile=${profile}, type=${type}, region=${region}, time=${timeStr}`, error);
      return profile === 'storage' ? 160 : 0;
    }
  }, [priceData, spreadData]);

  const value = {
    merchantPrices: priceData.monthly,
    getMerchantPrice,
    priceSource,
    setPriceSource,
    setMerchantPrices,
    spreadSource, 
    setSpreadSource
  };

  return (
    <MerchantPriceContext.Provider value={value}>
      {children}
    </MerchantPriceContext.Provider>
  );
}

export default MerchantPriceProvider;