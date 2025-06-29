// app/pages/test2/page.jsx
'use client';

import { useState, useEffect } from 'react';

export default function ZebreAssetsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [zebreData, setZebreData] = useState(null);
  const [tableSchema, setTableSchema] = useState(null);
  const [customQuery, setCustomQuery] = useState('SELECT * FROM workspace.default.zebre_assets_2025_06_24 LIMIT 50');
  const [queryResults, setQueryResults] = useState(null);
  const [loadingZebre, setLoadingZebre] = useState(false);

  // Target table details
  const TARGET_TABLE = 'workspace.default.zebre_assets_2025_06_24';

  useEffect(() => {
    testConnection();
    loadZebreAssets();
    describeZebreTable();
  }, []);

  const testConnection = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/databricks?action=test');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      if (data.result.success) {
        setConnectionStatus('Connected successfully!');
        console.log('Databricks connection test successful:', data);
      } else {
        throw new Error(data.result.error);
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setError(error.message);
      setConnectionStatus('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const loadZebreAssets = async () => {
    setLoadingZebre(true);
    setError(null);
    try {
      const response = await fetch(`/api/databricks?action=sample&table=${TARGET_TABLE}&limit=100`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      if (data.result.success) {
        setZebreData(data.result);
        console.log('Zebre assets data loaded:', data.result);
      } else {
        throw new Error(data.result.error);
      }
    } catch (error) {
      console.error('Failed to load Zebre assets:', error);
      setError(error.message);
    } finally {
      setLoadingZebre(false);
    }
  };

  const describeZebreTable = async () => {
    try {
      const response = await fetch('/api/databricks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `DESCRIBE ${TARGET_TABLE}` })
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      if (data.result.success) {
        setTableSchema(data.result);
        console.log('Table schema loaded:', data.result);
      }
    } catch (error) {
      console.error('Failed to describe table:', error);
    }
  };

  // Your deployed Vercel app URL with the real Databricks API
  const API_BASE = 'https://your-vercel-app-url.vercel.app'; // UPDATE THIS!

  const executeCustomQuery = async () => {
    if (!customQuery.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/databricks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: customQuery })
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      if (data.result.success) {
        setQueryResults(data.result);
        console.log('Query executed successfully:', data.result);
      } else {
        throw new Error(data.result.error);
      }
    } catch (error) {
      console.error('Query execution failed:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreData = async () => {
    setLoadingZebre(true);
    try {
      const response = await fetch('/api/databricks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `SELECT * FROM ${TARGET_TABLE} LIMIT 1000` })
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      if (data.result.success) {
        setZebreData(data.result);
        console.log('More Zebre assets data loaded:', data.result);
      } else {
        throw new Error(data.result.error);
      }
    } catch (error) {
      console.error('Failed to load more data:', error);
      setError(error.message);
    } finally {
      setLoadingZebre(false);
    }
  };

  const getTableStats = async () => {
    try {
      const response = await fetch('/api/databricks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `SELECT COUNT(*) as total_rows FROM ${TARGET_TABLE}` })
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      if (data.result.success) {
        console.log('Table stats:', data.result);
        alert(`Total rows in table: ${data.result.data[0][0]}`);
      }
    } catch (error) {
      console.error('Failed to get table stats:', error);
    }
  };

  const renderTable = (data) => {
    if (!data || !data.columns || !data.data) return null;

    return (
      <div className="overflow-x-auto bg-white shadow-lg rounded-lg border border-gray-200">
        <table className="min-w-full">
          <thead className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                #
              </th>
              {data.columns.map((column, index) => (
                <th
                  key={index}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.data.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50 transition-colors duration-200">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-500">
                  {rowIndex + 1}
                </td>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {cell !== null ? (
                      <span className="break-words max-w-xs block">
                        {String(cell)}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">NULL</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 py-3 bg-gray-50 text-xs text-gray-500 border-t flex justify-between items-center">
          <span>📊 Showing {data.data.length} rows • {data.columns.length} columns</span>
          <span className="font-medium">Table: {TARGET_TABLE}</span>
        </div>
      </div>
    );
  };

  const renderSchema = () => {
    if (!tableSchema || !tableSchema.data) return null;

    return (
      <div className="bg-white shadow-lg rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">📋 Table Schema</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tableSchema.data.map((column, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-4 border">
              <div className="font-semibold text-gray-900">{column[0]}</div>
              <div className="text-sm text-blue-600">{column[1]}</div>
              {column[2] && (
                <div className="text-xs text-gray-500 mt-1">{column[2]}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🦓 Zebre Assets Dashboard
          </h1>
          <p className="text-xl text-gray-600 mb-4">
            Data from: <code className="bg-gray-200 px-2 py-1 rounded text-green-600 font-mono">{TARGET_TABLE}</code>
          </p>
          
          {/* Connection Status */}
          <div className={`inline-flex items-center px-6 py-3 rounded-full text-sm font-semibold shadow-md ${
            connectionStatus === 'Connected successfully!' 
              ? 'bg-green-100 text-green-800 border-2 border-green-200' 
              : connectionStatus === 'Connection failed'
              ? 'bg-red-100 text-red-800 border-2 border-red-200'
              : 'bg-yellow-100 text-yellow-800 border-2 border-yellow-200'
          }`}>
            <span className={`w-3 h-3 rounded-full mr-3 ${
              connectionStatus === 'Connected successfully!' ? 'bg-green-400' : 'bg-red-400'
            }`}></span>
            {connectionStatus || 'Testing connection...'}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-8 bg-red-50 border-l-4 border-red-400 p-6 rounded-r-lg shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-red-800">⚠️ Error Occurred</h3>
                <div className="mt-2 text-sm text-red-700 font-mono bg-red-100 p-2 rounded">
                  {error}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <button
            onClick={loadZebreAssets}
            disabled={loadingZebre}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-3 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 shadow-lg"
          >
            {loadingZebre ? '⏳' : '🔄'} Refresh Data
          </button>
          
          <button
            onClick={loadMoreData}
            disabled={loadingZebre}
            className="bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-3 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 shadow-lg"
          >
            📊 Load 1000 Rows
          </button>
          
          <button
            onClick={getTableStats}
            className="bg-purple-500 hover:bg-purple-600 text-white font-semibold px-4 py-3 rounded-lg transition-all transform hover:scale-105 shadow-lg"
          >
            📈 Table Stats
          </button>
          
          <button
            onClick={describeZebreTable}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-3 rounded-lg transition-all transform hover:scale-105 shadow-lg"
          >
            📋 Show Schema
          </button>
        </div>

        {/* Table Schema */}
        {tableSchema && (
          <div className="mb-8">
            {renderSchema()}
          </div>
        )}

        {/* Main Data Display */}
        {zebreData && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                🦓 Zebre Assets Data
              </h2>
              <div className="flex items-center space-x-4">
                <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-semibold">
                  {zebreData.row_count} rows loaded
                </div>
                <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-semibold">
                  {zebreData.columns.length} columns
                </div>
              </div>
            </div>
            {renderTable(zebreData)}
          </div>
        )}

        {/* Custom Query Section */}
        <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-200 mb-8">
          <div className="flex items-center mb-6">
            <div className="bg-green-100 p-3 rounded-lg mr-4">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 002 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">⚡ Custom Query on Zebre Assets</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                SQL Query (pre-filled with Zebre table)
              </label>
              <textarea
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                rows={6}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-sm font-mono focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                placeholder="-- Query your Zebre assets table"
              />
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={executeCustomQuery}
                disabled={!customQuery.trim() || loading}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold px-6 py-3 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
              >
                {loading ? '⏳ Executing...' : '▶️ Execute Query'}
              </button>
              
              <button
                onClick={() => setCustomQuery(`SELECT COUNT(*) as total_assets FROM ${TARGET_TABLE}`)}
                className="bg-gray-500 hover:bg-gray-600 text-white font-semibold px-4 py-3 rounded-lg transition-all"
              >
                📊 Count Assets
              </button>
              
              <button
                onClick={() => setCustomQuery(`SELECT * FROM ${TARGET_TABLE} WHERE asset_name LIKE '%solar%' LIMIT 20`)}
                className="bg-gray-500 hover:bg-gray-600 text-white font-semibold px-4 py-3 rounded-lg transition-all"
              >
                🔍 Search Solar
              </button>
            </div>
          </div>
        </div>

        {/* Query Results */}
        {queryResults && (
          <div className="mb-8">
            <div className="flex items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                ⚡ Query Results
              </h2>
              <div className="ml-4 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                {queryResults.row_count} rows
              </div>
            </div>
            {renderTable(queryResults)}
          </div>
        )}

        {/* Loading Overlay */}
        {(loading || loadingZebre) && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 flex items-center space-x-4 shadow-2xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              <span className="text-gray-700 font-semibold text-lg">
                {loadingZebre ? '🦓 Loading Zebre data...' : '⏳ Processing...'}
              </span>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-16 text-center text-sm text-gray-500 bg-white rounded-lg p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-gray-700">🎯 Target Table</h4>
              <p className="font-mono text-green-600">{TARGET_TABLE}</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700">⚙️ Connection Status</h4>
              <p className={connectionStatus === 'Connected successfully!' ? 'text-green-600' : 'text-red-600'}>
                {connectionStatus || 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}