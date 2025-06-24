'use client'

import { useState } from 'react'
import { 
  FileText,
  Settings,
  Download,
  Eye,
  Calendar,
  Building2,
  DollarSign,
  TrendingUp,
  BarChart3,
  PieChart,
  Calculator,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

export default function ReportingPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('2024')
  const [selectedReports, setSelectedReports] = useState(['income', 'balance'])

  // Dummy accounting data
  const availableReports = [
    {
      id: 'income',
      name: 'Income Statement',
      description: 'Revenue, expenses, and profit/loss',
      icon: DollarSign,
      status: 'ready'
    },
    {
      id: 'balance',
      name: 'Balance Sheet',
      description: 'Assets, liabilities, and equity',
      icon: Building2,
      status: 'ready'
    },
    {
      id: 'cashflow',
      name: 'Cash Flow Statement',
      description: 'Operating, investing, and financing activities',
      icon: TrendingUp,
      status: 'pending'
    },
    {
      id: 'portfolio',
      name: 'Portfolio Performance',
      description: 'Asset-level revenue and performance metrics',
      icon: BarChart3,
      status: 'ready'
    },
    {
      id: 'ratios',
      name: 'Financial Ratios',
      description: 'Key performance indicators and ratios',
      icon: Calculator,
      status: 'ready'
    },
    {
      id: 'variance',
      name: 'Budget vs Actual',
      description: 'Variance analysis and explanations',
      icon: PieChart,
      status: 'updating'
    }
  ]

  const periods = ['2024', '2023', 'Q4 2024', 'Q3 2024', 'Q2 2024', 'Q1 2024']

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'updating':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'ready':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'updating':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const toggleReportSelection = (reportId) => {
    setSelectedReports(prev => 
      prev.includes(reportId) 
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId]
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reporting</h1>
        <p className="text-gray-600">Generate accounting statements and portfolio reports</p>
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <span className="text-blue-800 font-medium">Work in Progress</span>
          </div>
          <p className="text-blue-700 text-sm mt-2">
            This feature is under development. The interface shown below represents the planned functionality 
            for automated accounting statements and portfolio reporting.
          </p>
        </div>
      </div>

      {/* Report Controls */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Report Generation</h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <select 
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1 text-sm"
                >
                  {periods.map(period => (
                    <option key={period} value={period}>{period}</option>
                  ))}
                </select>
              </div>
              <button className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Download className="w-4 h-4" />
                <span>Generate Selected</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableReports.map((report) => {
              const Icon = report.icon
              const isSelected = selectedReports.includes(report.id)
              
              return (
                <div
                  key={report.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleReportSelection(report.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-green-100' : 'bg-gray-100'}`}>
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-green-600' : 'text-gray-600'}`} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{report.name}</h4>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(report.status)}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{report.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(report.status)}`}>
                      {report.status}
                    </span>
                    {isSelected && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Sample Income Statement */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Sample Income Statement - {selectedPeriod}</h3>
            <div className="flex space-x-2">
              <button className="flex items-center space-x-2 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                <Eye className="w-4 h-4" />
                <span>Preview</span>
              </button>
              <button className="flex items-center space-x-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium text-gray-900">Account</th>
                  <th className="text-right py-2 font-medium text-gray-900">{selectedPeriod} ($M)</th>
                  <th className="text-right py-2 font-medium text-gray-900">Prior Period ($M)</th>
                  <th className="text-right py-2 font-medium text-gray-900">Variance (%)</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b bg-gray-50">
                  <td className="py-2 font-semibold">REVENUE</td>
                  <td className="text-right py-2"></td>
                  <td className="text-right py-2"></td>
                  <td className="text-right py-2"></td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pl-4">Contracted Energy Revenue</td>
                  <td className="text-right py-2">45.2</td>
                  <td className="text-right py-2">42.8</td>
                  <td className="text-right py-2 text-green-600">+5.6%</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pl-4">Merchant Energy Revenue</td>
                  <td className="text-right py-2">28.7</td>
                  <td className="text-right py-2">31.2</td>
                  <td className="text-right py-2 text-red-600">-8.0%</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pl-4">Green Certificate Revenue</td>
                  <td className="text-right py-2">12.3</td>
                  <td className="text-right py-2">11.8</td>
                  <td className="text-right py-2 text-green-600">+4.2%</td>
                </tr>
                <tr className="border-b font-semibold">
                  <td className="py-2">Total Revenue</td>
                  <td className="text-right py-2">86.2</td>
                  <td className="text-right py-2">85.8</td>
                  <td className="text-right py-2 text-green-600">+0.5%</td>
                </tr>
                
                <tr className="border-b bg-gray-50">
                  <td className="py-2 font-semibold">EXPENSES</td>
                  <td className="text-right py-2"></td>
                  <td className="text-right py-2"></td>
                  <td className="text-right py-2"></td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pl-4">Operations & Maintenance</td>
                  <td className="text-right py-2">8.4</td>
                  <td className="text-right py-2">7.9</td>
                  <td className="text-right py-2 text-red-600">+6.3%</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pl-4">Management Fees</td>
                  <td className="text-right py-2">4.2</td>
                  <td className="text-right py-2">4.2</td>
                  <td className="text-right py-2">0.0%</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pl-4">Insurance</td>
                  <td className="text-right py-2">1.8</td>
                  <td className="text-right py-2">1.7</td>
                  <td className="text-right py-2 text-red-600">+5.9%</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pl-4">Interest Expense</td>
                  <td className="text-right py-2">15.6</td>
                  <td className="text-right py-2">16.2</td>
                  <td className="text-right py-2 text-green-600">-3.7%</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pl-4">Depreciation</td>
                  <td className="text-right py-2">22.3</td>
                  <td className="text-right py-2">21.8</td>
                  <td className="text-right py-2 text-red-600">+2.3%</td>
                </tr>
                <tr className="border-b font-semibold">
                  <td className="py-2">Total Expenses</td>
                  <td className="text-right py-2">52.3</td>
                  <td className="text-right py-2">51.8</td>
                  <td className="text-right py-2 text-red-600">+1.0%</td>
                </tr>
                
                <tr className="border-b font-bold text-lg">
                  <td className="py-3">Net Income</td>
                  <td className="text-right py-3 text-green-600">33.9</td>
                  <td className="text-right py-3">34.0</td>
                  <td className="text-right py-3 text-red-600">-0.3%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Revenue Margin</p>
              <p className="text-lg font-bold text-gray-900">39.3%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ROA</p>
              <p className="text-lg font-bold text-gray-900">8.2%</p>
            </div>
            <Calculator className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Debt Service Coverage</p>
              <p className="text-lg font-bold text-gray-900">1.45x</p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Asset Utilization</p>
              <p className="text-lg font-bold text-gray-900">94.7%</p>
            </div>
            <Building2 className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Status Footer */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-orange-500" />
            <span className="text-orange-800 font-medium">
              Reporting Module - Development Preview
            </span>
          </div>
          <div className="text-orange-600 text-sm">
            Coming Soon: Automated GAAP compliance, audit trails, multi-period comparisons
          </div>
        </div>
        <div className="mt-2 text-sm text-orange-700">
          This will generate standardized accounting statements with full audit trails, 
          automated journal entries, and compliance with renewable energy accounting standards.
        </div>
      </div>
    </div>
  )
}