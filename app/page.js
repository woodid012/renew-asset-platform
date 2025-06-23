'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Portfolio Manager
        </h1>
        <p className="text-xl text-gray-600">
          Energy Asset Performance Analysis Platform
        </p>
      </div>

      {/* Main Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Asset Management */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="text-blue-700">Asset Management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Configure assets, contracts, and portfolio settings
            </p>
            <div className="space-y-2 text-sm">
              <div>• Asset & Contract Definitions</div>
              <div>• Portfolio Inputs & Price Curves</div>
              <div>• Platform Settings</div>
            </div>
          </CardContent>
        </Card>

        {/* Analysis & Forecasting */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="text-green-700">Analysis & Forecasting</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Revenue projections and financial analysis
            </p>
            <div className="space-y-2 text-sm">
              <div>• Revenue Charts & Projections</div>
              <div>• 3-Way Financial Forecasts</div>
              <div>• AASB Compliant Statements</div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Management */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="text-red-700">Risk Management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Earnings at risk and scenario analysis
            </p>
            <div className="space-y-2 text-sm">
              <div>• Monte Carlo Simulations</div>
              <div>• Stress Testing</div>
              <div>• Scenario Comparisons</div>
            </div>
          </CardContent>
        </Card>

        {/* Data Export */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="text-purple-700">Data Export</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Export portfolio data and analysis results
            </p>
            <div className="space-y-2 text-sm">
              <div>• PPA Tables & Summaries</div>
              <div>• CSV Data Exports</div>
              <div>• Financial Statements</div>
            </div>
          </CardContent>
        </Card>

        {/* Portfolio Status */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="text-orange-700">Portfolio Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Current portfolio overview and metrics
            </p>
            <div className="space-y-2 text-sm">
              <div>• Assets Configured: <span className="font-semibold">0</span></div>
              <div>• Total Capacity: <span className="font-semibold">0 MW</span></div>
              <div>• Active Scenarios: <span className="font-semibold">1</span></div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="text-gray-700">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Common tasks and workflows
            </p>
            <div className="space-y-2 text-sm">
              <div>• Load Portfolio Data</div>
              <div>• Import Price Curves</div>
              <div>• Generate Reports</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Bar */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-blue-900">System Status</h3>
              <p className="text-blue-700 text-sm">Next.js migration complete • All systems operational</p>
            </div>
            <div className="text-right">
              <div className="text-blue-900 font-semibold">Ready</div>
              <div className="text-blue-600 text-sm">{new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}