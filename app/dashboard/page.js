'use client'

import { useState, useEffect } from 'react';
import { 
  Zap, 
  DollarSign, 
  TrendingUp, 
  Battery,
  Sun,
  Wind,
  Leaf,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';

const Dashboard = () => {
  const [projectData, setProjectData] = useState({
    totalCapacity: 0,
    totalProjects: 0,
    totalRevenue: 0,
    irr: 0,
    assets: []
  });

  // Mock data - replace with API call to your MongoDB backend
  useEffect(() => {
    // TODO: Replace with actual API call
    // fetchProjectData();
    
    // Mock data for now
    setProjectData({
      totalCapacity: 250, // MW
      totalProjects: 3,
      totalRevenue: 45.2, // Million AUD
      irr: 12.5, // %
      assets: [
        { name: 'Solar Farm Alpha', type: 'solar', capacity: 100, status: 'operational' },
        { name: 'Wind Farm Beta', type: 'wind', capacity: 120, status: 'construction' },
        { name: 'Battery Storage', type: 'battery', capacity: 30, status: 'planning' }
      ]
    });
  }, []);

  const getAssetIcon = (type) => {
    switch (type) {
      case 'solar': return <Sun className="w-5 h-5 text-yellow-500" />;
      case 'wind': return <Wind className="w-5 h-5 text-blue-500" />;
      case 'battery': return <Battery className="w-5 h-5 text-green-500" />;
      default: return <Zap className="w-5 h-5 text-gray-500" />;
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

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Portfolio Dashboard
        </h1>
        <p className="text-gray-600">
          Renewable Energy Asset Performance Overview
        </p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Capacity */}
        <div className="bg-white rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Capacity</p>
              <p className="text-2xl font-bold text-gray-900">
                {projectData.totalCapacity} MW
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <Zap className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Total Projects */}
        <div className="bg-white rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Projects</p>
              <p className="text-2xl font-bold text-gray-900">
                {projectData.totalProjects}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Leaf className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Annual Revenue */}
        <div className="bg-white rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Annual Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ${projectData.totalRevenue}M
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <DollarSign className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        {/* Portfolio IRR */}
        <div className="bg-white rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Portfolio IRR</p>
              <p className="text-2xl font-bold text-gray-900">
                {projectData.irr}%
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Asset Portfolio Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset List */}
        <div className="bg-white rounded-lg shadow border">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Asset Portfolio</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {projectData.assets.map((asset, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getAssetIcon(asset.type)}
                    <div>
                      <p className="font-medium text-gray-900">{asset.name}</p>
                      <p className="text-sm text-gray-500">{asset.capacity} MW</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(asset.status)}
                    <span className="text-sm capitalize text-gray-600">
                      {asset.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow border">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              <button className="w-full text-left p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded">
                    <Zap className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-green-900">Add New Asset</p>
                    <p className="text-sm text-green-700">Define new renewable energy project</p>
                  </div>
                </div>
              </button>
              
              <button className="w-full text-left p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">Update Market Curves</p>
                    <p className="text-sm text-blue-700">Refresh pricing and forecasts</p>
                  </div>
                </div>
              </button>
              
              <button className="w-full text-left p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 rounded">
                    <DollarSign className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-purple-900">Run Finance Model</p>
                    <p className="text-sm text-purple-700">Calculate returns and cashflows</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-green-800 font-medium">System Status: All systems operational</span>
          </div>
          <div className="text-green-600 text-sm">
            Last updated: {new Date().toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;