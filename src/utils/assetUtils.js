// assetUtils.js
export const calculateYear1Volume = (asset) => {
    if (!asset) return null;
    
    if (asset.type === 'storage') {
      if (!asset.volume || !asset.volumeLossAdjustment) return null;
      return (parseFloat(asset.volume) * 365 * (parseFloat(asset.volumeLossAdjustment) / 100)) / 1000;
    }
    
    if (asset.type === 'wind' || asset.type === 'solar') {
      if (!asset.capacity || 
          !asset.qtrCapacityFactor_q1 || 
          !asset.qtrCapacityFactor_q2 || 
          !asset.qtrCapacityFactor_q3 || 
          !asset.qtrCapacityFactor_q4) return null;
      
      const avgCapacityFactor = (
        parseFloat(asset.qtrCapacityFactor_q1) + 
        parseFloat(asset.qtrCapacityFactor_q2) + 
        parseFloat(asset.qtrCapacityFactor_q3) + 
        parseFloat(asset.qtrCapacityFactor_q4)
      ) / 400;
      
      return (parseFloat(asset.capacity) * avgCapacityFactor * 8760 * 
        (asset.volumeLossAdjustment ? (parseFloat(asset.volumeLossAdjustment) / 100) : 0.95)) / 1000;
    }
    
    return null;
  };
  
  export const formatNumericValue = (value) => 
    value === undefined || value === null || value === '' ? '' : String(value);
  
  export const handleNumericInput = (value, options = {}) => {
    const { 
      round = false,
      asString = false,
      min = null,
      max = null 
    } = options;
    
    if (value === '') return asString ? '' : null;
    
    let parsed = Number(value);
    if (isNaN(parsed)) return asString ? '' : null;
    
    if (min !== null) parsed = Math.max(min, parsed);
    if (max !== null) parsed = Math.min(max, parsed);
    if (round) parsed = Math.round(parsed);
    
    return asString ? String(parsed) : parsed;
  };
  
  export const getDefaultCapacityFactors = (asset, constants) => {
    if (!asset.state || !asset.type || asset.type === 'storage') {
      return {
        q1: '', q2: '', q3: '', q4: '',
        annual: ''
      };
    }
  
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const quarterlyFactors = {};
    
    quarters.forEach(quarter => {
      const defaultValue = constants.capacityFactors_qtr?.[asset.type]?.[asset.state]?.[quarter];
      quarterlyFactors[quarter.toLowerCase()] = defaultValue !== undefined ? 
        String(Math.round(defaultValue * 100)) : '';
    });
  
    const annualFactor = constants.capacityFactors?.[asset.type]?.[asset.state];
    quarterlyFactors.annual = annualFactor ? 
      String(Math.round(annualFactor * 100)) : '';
  
    return quarterlyFactors;
  };
  
  export const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [day, month, year] = dateStr.split('/');
    return !day || !month || !year ? '' : 
      `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };
  
  export const processAssetData = (rawData) => {
    return rawData.map(row => ({
      id: row.DUID,
      name: row['Station Name'],
      state: row.Region.substring(0, row.Region.length - 1),
      capacity: Math.round(parseFloat(row['Reg Cap generation (MW)'])),
      type: row['Fuel Source - Primary'].toLowerCase(),
      mlf: row['2024-25 MLF'] ? parseFloat(row['2024-25 MLF']) * 100 : null,
      startDate: row['StartDate'] ? formatDate(row['StartDate']) : ''
    }));
  };
  
  export const createNewContract = (contracts, defaultStartDate) => {
    // Use the provided start date if available, otherwise use today's date
    const startDate = defaultStartDate || new Date().toISOString().split('T')[0];
    
    // Calculate end date (10 years minus 1 day from start)
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(startDateObj);
    endDateObj.setFullYear(startDateObj.getFullYear() + 10);
    endDateObj.setDate(endDateObj.getDate() - 1); // Subtract one day
    const endDate = endDateObj.toISOString().split('T')[0];
  
    return {
      id: String(contracts.length + 1),
      counterparty: `Counterparty ${contracts.length + 1}`,
      type: '',
      buyersPercentage: '',
      shape: 'flat',
      strikePrice: '',
      greenPrice: '',
      EnergyPrice: '',
      indexation: '2.5',
      indexationReferenceYear: String(new Date().getFullYear()),
      settlementFormula: '',
      hasFloor: false,
      floorValue: '',
      startDate,
      endDate
    };
  };
  
  export const updateBundledPrices = (contract, field, value) => {
    if (contract.type !== 'bundled') return contract;
    
    if (field === 'strikePrice' || field === 'EnergyPrice') {
      const strikePrice = field === 'strikePrice' ? 
        Number(value) : Number(contract.strikePrice) || 0;
      const EnergyPrice = field === 'EnergyPrice' ? 
        Number(value) : Number(contract.EnergyPrice) || 0;
      return {
        ...contract,
        [field]: value,
        greenPrice: String(strikePrice - EnergyPrice)
      };
    }
    
    return { ...contract, [field]: value };
  };
