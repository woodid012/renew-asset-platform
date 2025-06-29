
'use client';

import { useState, useEffect } from 'react';

export default function TestBackendPage() {
  const [cashFlowData, setCashFlowData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState('all'); // New state for selected asset
  const [uniqueAssetIds, setUniqueAssetIds] = useState([]); // New state for unique asset IDs

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/monthly-cashflow');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setCashFlowData(data);

        // Extract unique asset IDs
        const assets = [...new Set(data.map(item => item.asset_id))].sort((a, b) => a - b);
        setUniqueAssetIds(assets);

      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="p-4">Loading monthly cash flow data...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  const filteredCashFlowData = selectedAsset === 'all'
    ? cashFlowData
    : cashFlowData.filter(row => row.asset_id === parseInt(selectedAsset));

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Monthly Cash Flow Data</h1>

      <div className="mb-4">
        <label htmlFor="asset-select" className="block text-sm font-medium text-gray-700">Filter by Asset:</label>
        <select
          id="asset-select"
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          value={selectedAsset}
          onChange={(e) => setSelectedAsset(e.target.value)}
        >
          <option value="all">All Assets</option>
          {uniqueAssetIds.map(assetId => (
            <option key={assetId} value={assetId}>{`Asset ${assetId}`}</option>
          ))}
        </select>
      </div>

      {filteredCashFlowData && filteredCashFlowData.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-300">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b">Asset ID</th>
                <th className="py-2 px-4 border-b">Date</th>
                <th className="py-2 px-4 border-b">Revenue</th>
                <th className="py-2 px-4 border-b">OPEX</th>
                <th className="py-2 px-4 border-b">CAPEX</th>
                <th className="py-2 px-4 border-b">CFADS</th>
                <th className="py-2 px-4 border-b">Interest</th>
                <th className="py-2 px-4 border-b">Principal</th>
                <th className="py-2 px-4 border-b">Equity Cash Flow</th>
                <th className="py-2 px-4 border-b">DSCR</th>
              </tr>
            </thead>
            <tbody>
              {filteredCashFlowData.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b text-center">{row.asset_id}</td>
                  <td className="py-2 px-4 border-b text-center">{row.date}</td>
                  <td className="py-2 px-4 border-b text-right">{row.revenue.toFixed(2)}</td>
                  <td className="py-2 px-4 border-b text-right">{row.opex.toFixed(2)}</td>
                  <td className="py-2 px-4 border-b text-right">{row.capex.toFixed(2)}</td>
                  <td className="py-2 px-4 border-b text-right">{row.cfads.toFixed(2)}</td>
                  <td className="py-2 px-4 border-b text-right">{row.interest.toFixed(2)}</td>
                  <td className="py-2 px-4 border-b text-right">{row.principal.toFixed(2)}</td>
                  <td className="py-2 px-4 border-b text-right">{row.equity_cash_flow.toFixed(2)}</td>
                  <td className="py-2 px-4 border-b text-right">{row.dscr !== null ? row.dscr.toFixed(2) : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No monthly cash flow data available for the selected asset.</p>
      )}
    </div>
  );
}
