'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';

// Import tab components
import ContractSummaryTab from './components/ContractSummaryTab';
import ContractInputTab from './components/ContractInputTab';
import PriceCurveTab from './components/PriceCurveTab';
import MarkToMarketTab from './components/MarkToMarketTab';
import TimeSeriesOutputTab from './components/TimeSeriesOutputTab';
import SettingsTab from './components/SettingsTab';

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

interface PriceCurveData {
  [key: string]: number[];
}

interface VolumeShapeData {
  [key: string]: number[];
}

interface SettingsData {
  contractTypes: {
    retail: string[];
    wholesale: string[];
    offtake: string[];
  };
  volumeShapes: {
    [key: string]: number[];
  };
  states: string[];
  indexationTypes: string[];
  unitTypes: string[];
}

const tabs = [
  { id: 'summary', label: 'Contract Summary' },
  { id: 'input', label: 'Contract Input' },
  { id: 'price-curve', label: 'Price Curves' },
  { id: 'mark-to-market', label: 'Mark to Market' },
  { id: 'time-series', label: 'Time Series Output' },
  { id: 'settings', label: 'Settings' },
];

const defaultSettings: SettingsData = {
  contractTypes: {
    retail: [
      'Retail Customer',
      'Industrial Customer',
      'Government Customer',
      'Small Business',
      'Residential'
    ],
    wholesale: [
      'Swap',
      'Cap',
      'Floor',
      'Forward',
      'Option'
    ],
    offtake: [
      'Solar Farm',
      'Wind Farm',
      'Battery Storage',
      'Hydro',
      'Gas Peaker'
    ]
  },
  volumeShapes: {
    flat: [8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33],
    solar: [6.5, 7.2, 8.8, 9.5, 10.2, 8.9, 9.1, 9.8, 8.6, 7.4, 6.8, 7.2],
    wind: [11.2, 10.8, 9.2, 7.8, 6.5, 5.9, 6.2, 7.1, 8.4, 9.6, 10.8, 11.5],
    custom: [5.0, 6.0, 7.5, 9.0, 11.0, 12.5, 13.0, 12.0, 10.5, 8.5, 7.0, 6.0]
  },
  states: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'],
  indexationTypes: [
    'Fixed',
    'CPI',
    'CPI + 1%',
    'CPI + 0.5%',
    'CPI + 2%',
    'Escalation 2%',
    'Escalation 3%'
  ],
  unitTypes: ['Energy', 'Green']
};

export default function EnergyContractManagement() {
  const [activeTab, setActiveTab] = useState('summary');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);

  // Market price curves (monthly average prices by state)
  const [marketPrices, setMarketPrices] = useState<PriceCurveData>({
    NSW: [85.20, 78.50, 72.30, 69.80, 75.60, 82.40, 89.70, 91.20, 86.50, 79.30, 74.80, 81.60],
    VIC: [82.10, 76.20, 70.50, 67.90, 73.20, 79.80, 86.30, 88.50, 83.70, 76.80, 72.40, 78.90],
    QLD: [88.50, 81.70, 75.80, 73.20, 78.90, 85.60, 92.10, 94.30, 89.20, 82.40, 77.60, 84.80],
    SA: [91.20, 84.60, 78.30, 75.70, 81.50, 88.90, 95.80, 98.20, 92.60, 85.30, 80.10, 87.40],
    WA: [79.80, 73.50, 67.90, 65.40, 71.20, 77.60, 83.90, 86.10, 81.40, 74.70, 70.20, 76.50]
  });

  // Volume shape profiles (monthly percentages) - will be managed by settings
  const [volumeShapes, setVolumeShapes] = useState<VolumeShapeData>(defaultSettings.volumeShapes);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('energyContractSettings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
        setVolumeShapes(parsedSettings.volumeShapes);
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('energyContractSettings', JSON.stringify(settings));
    setVolumeShapes(settings.volumeShapes);
  }, [settings]);

  // Fetch contracts from API
  useEffect(() => {
    const fetchContracts = async () => {
      try {
        setIsInitialLoading(true);
        const response = await fetch('/api/contracts');
        if (response.ok) {
          const data = await response.json();
          setContracts(data);
        } else {
          console.error('Failed to fetch contracts');
        }
      } catch (error) {
        console.error('Error fetching contracts:', error);
      } finally {
        setIsInitialLoading(false);
      }
    };

    fetchContracts();
  }, []);

  // Shared functions for contract management
  const addContract = async (newContract: Omit<Contract, '_id'>) => {
    try {
      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newContract),
      });

      if (response.ok) {
        const createdContract = await response.json();
        setContracts(prev => [...prev, createdContract]);
        return createdContract;
      } else {
        throw new Error('Failed to create contract');
      }
    } catch (error) {
      console.error('Error creating contract:', error);
      throw error;
    }
  };

  const updateContract = async (updatedContract: Contract) => {
    try {
      const response = await fetch('/api/contracts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedContract),
      });

      if (response.ok) {
        const updated = await response.json();
        setContracts(prev => 
          prev.map(contract => 
            (contract._id === updated._id || contract.id === updated.id) 
              ? updated 
              : contract
          )
        );
        if (selectedContract && (selectedContract._id === updated._id || selectedContract.id === updated.id)) {
          setSelectedContract(updated);
        }
        return updated;
      } else {
        throw new Error('Failed to update contract');
      }
    } catch (error) {
      console.error('Error updating contract:', error);
      throw error;
    }
  };

  const deleteContract = async (contractId: string) => {
    try {
      const response = await fetch(`/api/contracts?id=${contractId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setContracts(prev => prev.filter(contract => contract._id !== contractId && contract.id?.toString() !== contractId));
        if (selectedContract && (selectedContract._id === contractId || selectedContract.id?.toString() === contractId)) {
          setSelectedContract(null);
        }
      } else {
        throw new Error('Failed to delete contract');
      }
    } catch (error) {
      console.error('Error deleting contract:', error);
      throw error;
    }
  };

  const updateMarketPrices = (newPrices: PriceCurveData) => {
    setMarketPrices(newPrices);
  };

  const updateVolumeShapes = (newShapes: VolumeShapeData) => {
    setVolumeShapes(newShapes);
    // Also update in settings
    setSettings(prev => ({
      ...prev,
      volumeShapes: newShapes
    }));
  };

  const updateSettings = (newSettings: SettingsData) => {
    setSettings(newSettings);
    setVolumeShapes(newSettings.volumeShapes);
  };

  // Common props to pass to all tabs
  const commonProps = {
    contracts,
    selectedContract,
    setSelectedContract,
    timeSeriesData,
    setTimeSeriesData,
    isLoading,
    setIsLoading,
    marketPrices,
    volumeShapes,
    updateMarketPrices,
    updateVolumeShapes,
    addContract,
    updateContract,
    deleteContract,
    settings,
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <div className="text-gray-600">Loading Energy Contract Management System...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Energy Contract Management System</title>
        <meta name="description" content="Manage energy contracts with volume profiling and MtM analysis" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="max-w-7xl mx-auto p-5">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-8 rounded-xl mb-8 shadow-lg">
          <h1 className="text-4xl font-bold mb-3">Energy Contract Management System</h1>
          <p className="text-blue-100 text-lg">
            Manage wholesale, retail, and offtake energy contracts with flexible volume profiling and time series output
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl p-2 shadow-md border border-gray-200 mb-8">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`px-5 py-3 rounded-lg font-medium transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.id === 'settings' && <span>⚙️</span>}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-96">
          {activeTab === 'summary' && <ContractSummaryTab {...commonProps} />}
          {activeTab === 'input' && <ContractInputTab {...commonProps} />}
          {activeTab === 'price-curve' && <PriceCurveTab {...commonProps} />}
          {activeTab === 'mark-to-market' && <MarkToMarketTab {...commonProps} />}
          {activeTab === 'time-series' && <TimeSeriesOutputTab {...commonProps} />}
          {activeTab === 'settings' && (
            <SettingsTab 
              settings={settings} 
              updateSettings={updateSettings}
            />
          )}
        </div>
      </div>
    </>
  );
}