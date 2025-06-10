// app/page.tsx

'use client';

import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import { Contract, SettingsData, PriceCurve } from './types'; // Ensure central types are used
import ContractInputTab from './components/ContractInputTab';
import ContractSummaryTab from './components/ContractSummaryTab';
import PriceCurveTab from './components/PriceCurveTab';
import TimeSeriesOutputTab from './components/TimeSeriesOutputTab';
import SettingsTab from './components/SettingsTab';
import MarkToMarketTab from './components/MarkToMarketTab';

export default function Home() {
  const [activeTab, setActiveTab] = useState('summary');
  
  // Explicitly type all state variables that use the 'Contract' type
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [priceCurves, setPriceCurves] = useState<PriceCurve[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use useCallback to memoize fetch functions
  const fetchContracts = useCallback(async () => {
    try {
      const response = await fetch('/api/contracts');
      if (!response.ok) throw new Error(`Failed to fetch contracts: ${response.statusText}`);
      const data: Contract[] = await response.json(); // Ensure fetched data is cast to the correct type
      setContracts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching contracts.');
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error(`Failed to fetch settings: ${response.statusText}`);
      const data: SettingsData = await response.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching settings.');
    }
  }, []);

  const fetchPriceCurves = useCallback(async () => {
    try {
      const response = await fetch('/api/price-curves');
      if (!response.ok) throw new Error(`Failed to fetch price curves: ${response.statusText}`);
      const data: PriceCurve[] = await response.json();
      setPriceCurves(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching price curves.');
    }
  }, []);

  // Fetch all data on initial component mount
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      setError(null);
      await Promise.all([fetchContracts(), fetchSettings(), fetchPriceCurves()]);
      setLoading(false);
    };
    fetchAllData();
  }, [fetchContracts, fetchSettings, fetchPriceCurves]);

  // CRUD Operations for Contracts
  const addContract = async (newContract: Omit<Contract, '_id'>) => {
    try {
      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContract),
      });
      if (!response.ok) throw new Error('Failed to add contract');
      await fetchContracts(); // Refetch to get the latest list
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      throw err;
    }
  };

  const updateContract = async (updatedContract: Contract) => {
    try {
      const response = await fetch(`/api/contracts?id=${updatedContract._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedContract),
      });
      if (!response.ok) throw new Error('Failed to update contract');
      await fetchContracts(); // Refetch to get the latest list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      throw err;
    }
  };

  const deleteContract = async (contractId: string) => {
    try {
      const response = await fetch(`/api/contracts?id=${contractId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete contract');
      await fetchContracts(); // Refetch to get the latest list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-xl font-semibold text-gray-700">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50">
        <div className="text-xl font-semibold text-red-700">Error: {error}</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-xl font-semibold text-gray-700">Settings could not be loaded.</div>
      </div>
    );
  }

  // Props to be passed down to all tab components
  const commonProps = {
    contracts,
    selectedContract,
    setSelectedContract,
    settings,
    priceCurves,
    setPriceCurves,
    addContract,
    updateContract,
    deleteContract,
    fetchPriceCurves,
    marketPrices: {}, // Placeholder, adjust as needed
    volumeShapes: settings.volumeShapes || {},
  };
  
  const tabs = [
    { id: 'summary', label: '📊 Summary' },
    { id: 'input', label: '📝 Contract Input' },
    { id: 'price-curve', label: '📈 Price Curves' },
    { id: 'mark-to-market', label: '💹 Mark-to-Market' },
    { id: 'time-series', label: '⏳ Time Series Output' },
    { id: 'settings', label: '⚙️ Settings' },
  ];

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800">Energy Portfolio Management</h1>
          <p className="text-gray-600 mt-2">
            A comprehensive dashboard for managing energy contracts and analyzing market data.
          </p>
        </header>

        {/* Tab Navigation */}
        <div className="mb-6 bg-white rounded-lg shadow-sm p-2 border border-gray-200">
          <nav className="flex flex-wrap items-center">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm sm:text-base font-medium rounded-md transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="min-h-96">
          {activeTab === 'summary' && <ContractSummaryTab {...commonProps} />}
          {activeTab === 'input' && <ContractInputTab {...commonProps} />}
          {activeTab === 'price-curve' && <PriceCurveTab {...commonProps} />}
          {activeTab === 'mark-to-market' && <MarkToMarketTab {...commonProps} />}
          {activeTab === 'time-series' && <TimeSeriesOutputTab {...commonProps} />}
          {activeTab === 'settings' && <SettingsTab {...commonProps} />}
        </div>
      </div>
    </div>
  );
}