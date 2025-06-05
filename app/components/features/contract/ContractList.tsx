'use client';

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
  // New fields
  pricingType?: 'fixed' | 'escalation' | 'timeseries' | 'custom_time_of_day';
  escalationRate?: number;
  priceTimeSeries?: number[];
  priceInterval?: 'monthly' | 'quarterly' | 'yearly';
  productDetail?: 'CY' | 'FY' | 'Q1' | 'Q2' | 'Q3' | 'Q4';
  // Custom time-based pricing
  timeBasedPricing?: {
    periods: Array<{
      id: string;
      name: string;
      price: number;
      startTime: string; // "07:00"
      endTime: string;   // "22:00"
      daysOfWeek: boolean[]; // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    }>;
    defaultPrice: number;
  };
  // Custom volume data (time series at hourly/daily level)
  customVolumeData?: {
    interval: 'hourly' | 'daily' | 'monthly';
    data: number[]; // MWh values
    startDate: string;
  };
}

interface ContractListProps {
  contracts: Contract[];
  selectedContract: Contract | null;
  onSelectContract: (contract: Contract | null) => void;
  onEditContract: (contract: Contract) => void;
  onDeleteContract: (contract: Contract) => void;
}

export default function ContractList({
  contracts,
  selectedContract,
  onSelectContract,
  onEditContract,
  onDeleteContract,
}: ContractListProps) {
  
  const getContractTypeColor = (type: string) => {
    switch (type) {
      case 'retail': return 'bg-orange-100 text-orange-800';
      case 'wholesale': return 'bg-green-100 text-green-800';
      case 'offtake': return 'bg-purple-100 text-purple-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'active'
      ? 'bg-green-100 text-green-800'
      : 'bg-yellow-100 text-yellow-800';
  };

  const getPricingTypeLabel = (contract: Contract) => {
    switch (contract.pricingType) {
      case 'fixed': return 'Fixed';
      case 'escalation': return 'Escalation';
      case 'timeseries': return 'Time Series';
      case 'custom_time_of_day': return 'Time-of-Day';
      default: return 'Fixed';
    }
  };

  const handleDeleteClick = async (contract: Contract) => {
    if (!contract._id && !contract.id) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete "${contract.name}"?`);
    if (!confirmed) return;

    try {
      await onDeleteContract(contract);
    } catch (error) {
      console.error('Error deleting contract:', error);
      alert('Failed to delete contract. Please try again.');
    }
  };

  const handleRowClick = (contract: Contract) => {
    onSelectContract(contract);
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          📋 Contract Portfolio
        </h2>
        <div className="text-sm text-gray-600">
          {contracts.length} contract{contracts.length !== 1 ? 's' : ''} total
        </div>
      </div>
      
      {contracts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="mb-4">
            <div className="text-6xl mb-4">📄</div>
            <p className="text-lg">No contracts found</p>
            <p className="text-sm">Get started by adding your first contract</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left p-4 font-semibold text-gray-700">Name</th>
                <th className="text-left p-4 font-semibold text-gray-700">Type</th>
                <th className="text-left p-4 font-semibold text-gray-700">Category</th>
                <th className="text-left p-4 font-semibold text-gray-700">State</th>
                <th className="text-left p-4 font-semibold text-gray-700">Counterparty</th>
                <th className="text-left p-4 font-semibold text-gray-700">Annual Volume</th>
                <th className="text-left p-4 font-semibold text-gray-700">Unit</th>                 
                <th className="text-left p-4 font-semibold text-gray-700">Pricing</th>
                <th className="text-left p-4 font-semibold text-gray-700">Period</th>
                <th className="text-left p-4 font-semibold text-gray-700">Status</th>
                <th className="text-left p-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract, index) => (
                <tr
                  key={contract._id || contract.id || index}
                  onClick={() => handleRowClick(contract)}
                  className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedContract && (selectedContract._id === contract._id || selectedContract.id === contract.id)
                      ? 'bg-blue-50 border-l-4 border-l-blue-500'
                      : ''
                  }`}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${contract.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                      <span className="font-medium text-gray-900">{contract.name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${getContractTypeColor(contract.type)}`}>
                      {contract.type}
                    </span>
                  </td>
                  <td className="p-4 text-gray-700">{contract.category}</td>
                  <td className="p-4 text-gray-700">{contract.state}</td>
                  <td className="p-4 text-gray-700">{contract.counterparty}</td>
                  <td className="p-4 text-gray-700">
                    {contract.type === 'wholesale' 
                      ? `${contract.annualVolume.toLocaleString()} MW`
                      : `${contract.annualVolume.toLocaleString()} MWh`
                    }
                  </td>
                  <td className="p-4 text-gray-700">{contract.unit}</td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-gray-900 font-medium">
                        ${contract.strikePrice}/MWh
                      </span>
                      <span className="text-xs text-gray-500">
                        {getPricingTypeLabel(contract)}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-xs">
                    <div>{contract.startDate}</div>
                    <div>to {contract.endDate}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(contract.status)}`}>
                      {contract.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditContract(contract);
                        }}
                        className="bg-blue-500 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-600 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(contract);
                        }}
                        className="bg-red-500 text-white px-3 py-1 rounded text-xs font-medium hover:bg-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}