'use client';

import { useState } from 'react';

interface Contract {
  _id?: string;
  id?: number;
  name: string;
  type: 'retail' | 'wholesale' | 'offtake';
  category: string;
  state: string;
  counterparty: string;
  startDate: string;
  endDate: string;
  annualVolume: number;
  strikePrice: number;
  unit: string;
  volumeShape: 'flat' | 'solar' | 'wind' | 'custom';
  status: 'active' | 'pending';
  indexation: string;
  referenceDate: string;
}

interface TimeSeriesRow {
  buysell: string;
  deal_name: string;
  state: string;
  type: string;
  month_start: number;
  year: number;
  fy: number;
  unit: string;
  scenario: string;
  sub_type: string;
  volume_pct: number;
  volume_mwh: string;
  strike_price: number;
  strike_price_x_volume: number;
  market_price: number;
  market_price_x_volume: number;
  net_mtm: number;
}

interface TimeSeriesOutputTabProps {
  contracts: Contract[];
  timeSeriesData: TimeSeriesRow[];
  setTimeSeriesData: (data: TimeSeriesRow[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  marketPrices: { [key: string]: number[] };
  volumeShapes: { [key: string]: number[] };
}

export default function TimeSeriesOutputTab({
  contracts,
  timeSeriesData,
  setTimeSeriesData,
  isLoading,
  setIsLoading,
  marketPrices,
  volumeShapes,
}: TimeSeriesOutputTabProps) {
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  const [year, setYear] = useState('2026');
  const [interval, setInterval] = useState('M');
  const [scenario, setScenario] = useState('Central');
  const [exportFormat, setExportFormat] = useState('csv');

  const generateTimeSeries = async () => {
    setIsLoading(true);
    
    let outputData: TimeSeriesRow[] = [];
    const contractsToProcess = selectedContracts.length > 0 
      ? contracts.filter(c => selectedContracts.includes(c._id || c.id?.toString() || ''))
      : contracts;
    
    contractsToProcess.forEach(contract => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const volumeProfile = volumeShapes[contract.volumeShape];
      
      if (interval === 'M') {
        months.forEach((month, index) => {
          const buySell = contract.type === 'retail' ? 'Sell' : 'Buy';
          const volumePct = volumeProfile[index];
          const actualVolume = contract.annualVolume * volumePct / 100;
          const marketPrice = marketPrices[contract.state][index];
          const strikePriceXVolume = actualVolume * contract.strikePrice;
          const marketPriceXVolume = actualVolume * marketPrice;
          
          let netMtM;
          if (contract.type === 'retail') {
            netMtM = strikePriceXVolume - marketPriceXVolume;
          } else {
            netMtM = marketPriceXVolume - strikePriceXVolume;
          }
          
          outputData.push({
            buysell: buySell,
            deal_name: contract.name,
            state: contract.state,
            type: contract.category,
            month_start: index + 1,
            year: parseInt(year),
            fy: parseInt(year),
            unit: contract.unit,
            scenario: scenario,
            sub_type: contract.category,
            volume_pct: volumePct,
            volume_mwh: actualVolume.toFixed(0),
            strike_price: contract.strikePrice,
            strike_price_x_volume: strikePriceXVolume,
            market_price: marketPrice,
            market_price_x_volume: marketPriceXVolume,
            net_mtm: netMtM
          });
        });
      } else if (interval === 'Y') {
        // Yearly data - sum all months
        const totalVolume = contract.annualVolume;
        const avgMarketPrice = marketPrices[contract.state].reduce((sum, price) => sum + price, 0) / 12;
        const strikePriceXVolume = totalVolume * contract.strikePrice;
        const marketPriceXVolume = totalVolume * avgMarketPrice;
        
        let netMtM;
        if (contract.type === 'retail') {
          netMtM = strikePriceXVolume - marketPriceXVolume;
        } else {
          netMtM = marketPriceXVolume - strikePriceXVolume;
        }
        
        outputData.push({
          buysell: contract.type === 'retail' ? 'Sell' : 'Buy',
          deal_name: contract.name,
          state: contract.state,
          type: contract.category,
          month_start: 1,
          year: parseInt(year),
          fy: parseInt(year),
          unit: contract.unit,
          scenario: scenario,
          sub_type: contract.category,
          volume_pct: 100,
          volume_mwh: totalVolume.toFixed(0),
          strike_price: contract.strikePrice,
          strike_price_x_volume: strikePriceXVolume,
          market_price: avgMarketPrice,
          market_price_x_volume: marketPriceXVolume,
          net_mtm: netMtM
        });
      }
    });
    
    setTimeSeriesData(outputData);
    setIsLoading(false);
  };

  const exportData = () => {
    if (timeSeriesData.length === 0) {
      alert('No data to export. Please generate time series first.');
      return;
    }

    if (exportFormat === 'csv') {
      exportToCSV();
    } else if (exportFormat === 'json') {
      exportToJSON();
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Buy/Sell', 'Deal Name', 'State', 'Type', 'Month', 'Year', 'FY', 'Unit',
      'Scenario', 'Sub Type', 'Volume %', 'Volume (MWh)', 'Strike Price',
      'Strike Price × Volume', 'Market Price', 'Market Price × Volume', 'Net MtM'
    ];

    const csvContent = [
      headers.join(','),
      ...timeSeriesData.map(row => [
        row.buysell,
        `"${row.deal_name}"`,
        row.state,
        `"${row.type}"`,
        row.month_start,
        row.year,
        row.fy,
        row.unit,
        row.scenario,
        `"${row.sub_type}"`,
        row.volume_pct.toFixed(2),
        row.volume_mwh,
        row.strike_price.toFixed(2),
        row.strike_price_x_volume.toFixed(2),
        row.market_price.toFixed(2),
        row.market_price_x_volume.toFixed(2),
        row.net_mtm.toFixed(2)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `energy_contracts_timeseries_${year}_${scenario}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    const jsonContent = JSON.stringify(timeSeriesData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `energy_contracts_timeseries_${year}_${scenario}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleContractToggle = (contractId: string) => {
    setSelectedContracts(prev => 
      prev.includes(contractId) 
        ? prev.filter(id => id !== contractId)
        : [...prev, contractId]
    );
  };

  const selectAllContracts = () => {
    setSelectedContracts(contracts.map(c => c._id || c.id?.toString() || ''));
  };

  const clearSelection = () => {
    setSelectedContracts([]);
  };

  // Calculate summary statistics
  const summaryStats = {
    totalRows: timeSeriesData.length,
    totalVolume: timeSeriesData.reduce((sum, row) => sum + parseFloat(row.volume_mwh), 0),
    totalMtM: timeSeriesData.reduce((sum, row) => sum + row.net_mtm, 0),
    uniqueContracts: new Set(timeSeriesData.map(row => row.deal_name)).size,
    uniqueStates: new Set(timeSeriesData.map(row => row.state)).size,
  };

  return (
    <div className="timeseries-container">
      {/* Generation Controls */}
      <div className="controls">
        <h3>🔧 Time Series Generation Controls</h3>
        
        <div className="control-sections">
          {/* Contract Selection */}
          <div className="control-section">
            <h4>Contract Selection</h4>
            <div className="contract-selection">
              <div className="selection-actions">
                <button className="btn-small btn-primary" onClick={selectAllContracts}>
                  Select All
                </button>
                <button className="btn-small btn-secondary" onClick={clearSelection}>
                  Clear All
                </button>
                <span className="selection-count">
                  {selectedContracts.length === 0 ? 'All contracts' : `${selectedContracts.length} selected`}
                </span>
              </div>
              
              <div className="contract-checkboxes">
                {contracts.map(contract => (
                  <label key={contract._id || contract.id} className="contract-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedContracts.includes(contract._id || contract.id?.toString() || '')}
                      onChange={() => handleContractToggle(contract._id || contract.id?.toString() || '')}
                    />
                    <span className="checkbox-label">
                      {contract.name} ({contract.state})
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Parameters */}
          <div className="control-section">
            <h4>Generation Parameters</h4>
            <div className="parameter-grid">
              <div className="form-group">
                <label htmlFor="yearSelect">Financial Year</label>
                <select id="yearSelect" value={year} onChange={(e) => setYear(e.target.value)}>
                  <option value="2024">FY 2024</option>
                  <option value="2025">FY 2025</option>
                  <option value="2026">FY 2026</option>
                  <option value="2027">FY 2027</option>
                  <option value="2028">FY 2028</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="intervalSelect">Time Interval</label>
                <select id="intervalSelect" value={interval} onChange={(e) => setInterval(e.target.value)}>
                  <option value="M">Monthly</option>
                  <option value="Y">Yearly</option>
                  <option value="D" disabled>Daily (Coming Soon)</option>
                  <option value="5M" disabled>5-Minute (Coming Soon)</option>
                  <option value="30M" disabled>30-Minute (Coming Soon)</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="scenarioSelect">Scenario</label>
                <select id="scenarioSelect" value={scenario} onChange={(e) => setScenario(e.target.value)}>
                  <option value="Central">Central</option>
                  <option value="High">High</option>
                  <option value="Low">Low</option>
                  <option value="Stress">Stress Test</option>
                </select>
              </div>
              
              <div className="form-group">
                <button className="btn btn-primary" onClick={generateTimeSeries} disabled={isLoading}>
                  {isLoading ? 'Generating...' : 'Generate Time Series'}
                </button>
              </div>
            </div>
          </div>

          {/* Export Options */}
          <div className="control-section">
            <h4>Export Options</h4>
            <div className="export-controls">
              <div className="form-group">
                <label htmlFor="exportFormat">Export Format</label>
                <select id="exportFormat" value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                  <option value="excel" disabled>Excel (Coming Soon)</option>
                </select>
              </div>
              
              <button 
                className="btn btn-success" 
                onClick={exportData}
                disabled={timeSeriesData.length === 0}
              >
                📊 Export Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      {timeSeriesData.length > 0 && (
        <div className="card summary-panel">
          <h2>📈 Generation Summary</h2>
          <div className="summary-grid">
            <div className="summary-stat">
              <span className="stat-label">Total Rows:</span>
              <span className="stat-value">{summaryStats.totalRows.toLocaleString()}</span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Total Volume:</span>
              <span className="stat-value">{summaryStats.totalVolume.toLocaleString()} MWh</span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Net MtM:</span>
              <span className={`stat-value ${summaryStats.totalMtM >= 0 ? 'positive' : 'negative'}`}>
                {summaryStats.totalMtM >= 0 ? '+' : ''}${summaryStats.totalMtM.toLocaleString()}
              </span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Contracts:</span>
              <span className="stat-value">{summaryStats.uniqueContracts}</span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">States:</span>
              <span className="stat-value">{summaryStats.uniqueStates}</span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Period:</span>
              <span className="stat-value">{year} ({interval === 'M' ? 'Monthly' : 'Yearly'})</span>
            </div>
          </div>
        </div>
      )}

      {/* Data Output Table */}
      <div className="output-section">
        <div className="output-header">
          <h2>📈 Time Series Output</h2>
          {timeSeriesData.length > 0 && (
            <div className="output-actions">
              <button className="btn-small btn-info" onClick={() => window.print()}>
                🖨️ Print
              </button>
              <button className="btn-small btn-success" onClick={exportData}>
                📊 Export
              </button>
            </div>
          )}
        </div>
        
        <div className="table-container">
          <table className="output-table">
            <thead>
              <tr>
                <th>Buy/Sell</th>
                <th>Deal Name</th>
                <th>State</th>
                <th>Type</th>
                <th>Month</th>
                <th>Year</th>
                <th>FY</th>
                <th>Unit</th>
                <th>Scenario</th>
                <th>Sub Type</th>
                <th>Volume %</th>
                <th>Volume (MWh)</th>
                <th>Strike Price</th>
                <th>Strike Price × Volume</th>
                <th>Market Price</th>
                <th>Market Price × Volume</th>
                <th>Net MtM</th>
              </tr>
            </thead>
            <tbody>
              {timeSeriesData.length === 0 ? (
                <tr>
                  <td colSpan={17} className="no-data">
                    Click "Generate Time Series" to see output data
                  </td>
                </tr>
              ) : (
                timeSeriesData.map((row, index) => (
                  <tr key={index}>
                    <td>{row.buysell}</td>
                    <td>{row.deal_name}</td>
                    <td>{row.state}</td>
                    <td>{row.type}</td>
                    <td>{row.month_start}</td>
                    <td>{row.year}</td>
                    <td>{row.fy}</td>
                    <td>{row.unit}</td>
                    <td>{row.scenario}</td>
                    <td>{row.sub_type}</td>
                    <td>{row.volume_pct.toFixed(1)}%</td>
                    <td>{parseFloat(row.volume_mwh).toLocaleString()}</td>
                    <td>${row.strike_price.toFixed(2)}</td>
                    <td>${row.strike_price_x_volume.toLocaleString()}</td>
                    <td>${row.market_price.toFixed(2)}</td>
                    <td>${row.market_price_x_volume.toLocaleString()}</td>
                    <td className={row.net_mtm >= 0 ? 'positive' : 'negative'}>
                      ${row.net_mtm.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}