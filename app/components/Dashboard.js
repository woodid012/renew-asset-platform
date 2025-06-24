// app/components/Dashboard.js - Pure dashboard component
'use client'

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { 
  Zap, 
  DollarSign, 
  TrendingUp, 
  Battery,
  Sun,
  Wind,
  FileText,
  Calculator,
  BarChart3,
  Building2,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { calculateIRR } from '@/app/components/ProjectFinance_Calcs';

export default function Dashboard({ 
  portfolioName,
  portfolioMetrics,
  revenueProjections,
  assets,
  projectMetrics
}) {
  // Helper functions
  const getAssetIcon = (type) => {
    switch (type) {
      case 'solar': return <Sun className="w-4 h-4 text-yellow-500" />;
      case 'wind': return <Wind className="w-4 h-4 text-blue-500" />;
      case 'storage': return <Battery className="w-4 h-4 text-green-500" />;
      default: return <Zap className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'operational': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'construction': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'planning': return <AlertCircle className="w-4 h-4 text-blue-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getAssetStatus = (asset) => {
    if (!asset.assetStartDate) return 'planning';
    
    const startDate = new Date(asset.assetStartDate);
    const now = new Date();
    const constructionStart = asset.constructionStartDate ? new Date(asset.constructionStartDate) : null;
    
    if (now >= startDate) return 'operational';
    if (constructionStart && now >= constructionStart) return 'construction';
    return 'planning';
  };

  // IRR Sensitivity Tornado Component
  const IRRSensitivityTornado = ({ portfolioIRR }) => {
    const [sensitivityData, setSensitivityData] = useState([]);

    useEffect(() => {
      const checkForFinanceData = () => {
        try {
          const financeData = localStorage.getItem('financeSensitivityData');
          if (financeData) {
            const parsedData = JSON.parse(financeData);
            setSensitivityData(parsedData);
          } else if (portfolioIRR > 0) {
            // Generate estimated data
            const estimatedData = [
              { parameter: "Volume", baseIRR: portfolioIRR, downside: -0.93, upside: 3.44 },
              { parameter: "CAPEX", baseIRR: portfolioIRR, downside: -1.10, upside: 1.63 },
              { parameter: "Electricity Price", baseIRR: portfolioIRR, downside: -0.70, upside: 0.72 },
              { parameter: "Interest Rate", baseIRR: portfolioIRR, downside: -0.27, upside: 0.48 },
              { parameter: "OPEX", baseIRR: portfolioIRR, downside: -0.27, upside: 0.28 },
              { parameter: "Terminal Value", baseIRR: portfolioIRR, downside: -0.18, upside: 0.17 }
            ];
            setSensitivityData(estimatedData);
          }
        } catch (error) {
          console.error('Error loading sensitivity data:', error);
        }
      };

      checkForFinanceData();
      const interval = setInterval(checkForFinanceData, 2000);
      return () => clearInterval(interval);
    }, [portfolioIRR]);

    if (portfolioIRR <= 0 || sensitivityData.length === 0) {
      return (
        <div className="text-center text-gray-500 py-8">
          <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No sensitivity data available</p>
        </div>
      );
    }

    const sortedData = [...sensitivityData].sort((a, b) => 
      (Math.abs(b.upside) + Math.abs(b.downside)) - (Math.abs(a.upside) + Math.abs(a.downside))
    );
    
    const maxAbsValue = Math.max(...sortedData.flatMap(d => [Math.abs(d.downside), Math.abs(d.upside)]));
    const scale = 150 / maxAbsValue;

    return (
      <div>
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Base IRR:</strong> {portfolioIRR.toFixed(1)}% • 
            <strong>Sensitivity Range:</strong> {sortedData.length} parameters
          </p>
        </div>

        <div className="space-y-3">
          {sortedData.map((item, index) => (
            <div key={item.parameter} className="flex items-center h-10">
              <div className="w-24 text-right pr-4 text-xs font-medium text-gray-700">
                {item.parameter}
              </div>
              
              <div className="flex-1 relative">
                <div className="flex items-center justify-center h-full">
                  {/* Left side (downside) */}
                  <div className="flex items-center justify-end" style={{ width: `${150}px` }}>
                    <span className="text-xs font-medium text-red-600 mr-2">
                      {item.downside.toFixed(1)}pp
                    </span>
                    <div 
                      className="bg-red-500 h-6 rounded-l"
                      style={{ width: `${Math.abs(item.downside) * scale}px` }}
                    />
                  </div>
                  
                  {/* Right side (upside) */}
                  <div className="flex items-center justify-start" style={{ width: `${150}px` }}>
                    <div 
                      className="bg-green-500 h-6 rounded-r"
                      style={{ width: `${Math.abs(item.upside) * scale}px` }}
                    />
                    <span className="text-xs font-medium text-green-600 ml-2">
                      +{item.upside.toFixed(1)}pp
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 flex justify-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-xs text-gray-700">Downside Impact</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-xs text-gray-700">Upside Impact</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {portfolioName} Dashboard
        </h1>
        <p className="text-gray-600">
          Portfolio performance summary
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        {/* Total Capacity */}
        <div className="bg-white rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Capacity</p>
              <p className="text-2xl font-bold text-gray-900">
                {portfolioMetrics.totalCapacity.toFixed(1)} MW
              </p>
              <p className="text-sm text-gray-500">{portfolioMetrics.totalProjects} assets</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <Zap className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Total CAPEX */}
        <div className="bg-white rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total CAPEX</p>
              <p className="text-2xl font-bold text-gray-900">
                ${portfolioMetrics.totalCapex.toFixed(1)}M
              </p>
              <p className="text-sm text-gray-500">
                {portfolioMetrics.totalCapex > 0 ? 
                  `${((portfolioMetrics.totalDebt/portfolioMetrics.totalCapex)*100).toFixed(0)}% debt` : 
                  'No debt data'
                }
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Calculator className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Debt/Equity Split */}
        <div className="bg-white rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Debt/Equity</p>
              <p className="text-lg font-bold text-red-700">
                ${portfolioMetrics.totalDebt.toFixed(1)}M
              </p>
              <p className="text-lg font-bold text-green-700">
                ${portfolioMetrics.totalEquity.toFixed(1)}M
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Year 10 Revenue */}
        <div className="bg-white rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Year 10 Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ${portfolioMetrics.year10Revenue.toFixed(1)}M
              </p>
              <p className="text-sm text-gray-500">
                {portfolioMetrics.contractedPercentage.toFixed(0)}% contracted
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <FileText className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        {/* Portfolio IRR */}
        <div className="bg-white rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Portfolio IRR</p>
              <p className="text-2xl font-bold text-gray-900">
                {portfolioMetrics.portfolioIRR.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-500">30-year equity</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Projections */}
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Revenue Projections (30-Year)</h3>
          {revenueProjections.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueProjections}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip formatter={(value) => [`$${value.toFixed(1)}M`, '']} />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="contractedRevenue" 
                  stackId="1"
                  stroke="#10B981" 
                  fill="#10B981"
                  name="Contracted Revenue"
                />
                <Area 
                  type="monotone" 
                  dataKey="merchantRevenue" 
                  stackId="1"
                  stroke="#F59E0B" 
                  fill="#F59E0B"
                  name="Merchant Revenue"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No revenue data available</p>
            </div>
          )}
        </div>

        {/* IRR Sensitivity Tornado */}
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">IRR Sensitivity Analysis</h3>
          <IRRSensitivityTornado portfolioIRR={portfolioMetrics.portfolioIRR} />
        </div>
      </div>

      {/* Project List */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Project List</h3>
        
        {Object.values(assets).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-900">Project</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900">Type</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-900">Capacity (MW)</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-900">CAPEX ($M)</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-900">Start Date</th>
                  <th className="text-center py-3 px-2 font-medium text-gray-900">Status</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-900">IRR (%)</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(assets).map((asset, index) => {
                  const assetMetrics = projectMetrics[asset.name];
                  const assetIRR = assetMetrics?.equityCashFlows ? calculateIRR(assetMetrics.equityCashFlows) : null;
                  const status = getAssetStatus(asset);
                  
                  return (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2">
                        <div className="flex items-center space-x-2">
                          {getAssetIcon(asset.type)}
                          <span className="font-medium text-gray-900">{asset.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-gray-700 capitalize">{asset.type}</td>
                      <td className="text-right py-3 px-2 text-gray-700">{asset.capacity}</td>
                      <td className="text-right py-3 px-2 text-gray-700">
                        {assetMetrics?.capex ? `$${assetMetrics.capex.toFixed(1)}M` : '-'}
                      </td>
                      <td className="text-right py-3 px-2 text-gray-700">
                        {asset.assetStartDate ? new Date(asset.assetStartDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="text-center py-3 px-2">
                        <div className="flex items-center justify-center space-x-1">
                          {getStatusIcon(status)}
                          <span className={`text-xs capitalize px-2 py-1 rounded-full ${
                            status === 'operational' ? 'bg-green-100 text-green-800' :
                            status === 'construction' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {status}
                          </span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-2 font-medium text-gray-900">
                        {assetIRR ? `${(assetIRR * 100).toFixed(1)}%` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No projects configured</p>
            <p className="text-sm">Add projects to see portfolio summary</p>
          </div>
        )}
      </div>
    </div>
  );
}