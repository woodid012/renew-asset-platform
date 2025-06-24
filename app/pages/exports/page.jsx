'use client'

import { useState } from 'react'
import { 
  Download,
  Settings,
  FileText,
  Table,
  Image,
  File,
  Database,
  Cloud,
  Calendar,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  Play,
  Trash2,
  Eye
} from 'lucide-react'

export default function ExportsPage() {
  const [selectedFormat, setSelectedFormat] = useState('excel')
  const [selectedData, setSelectedData] = useState(['portfolio', 'revenue'])
  const [exportHistory, setExportHistory] = useState([
    {
      id: 1,
      name: 'Portfolio Analysis Q4 2024',
      format: 'Excel',
      size: '2.4 MB',
      date: '2024-12-15 14:30',
      status: 'completed',
      downloadUrl: '#'
    },
    {
      id: 2,
      name: 'Revenue Projections 30-Year',
      format: 'PDF',
      size: '1.8 MB',
      date: '2024-12-14 11:22',
      status: 'completed',
      downloadUrl: '#'
    },
    {
      id: 3,
      name: 'Asset Performance Dashboard',
      format: 'PNG',
      size: '845 KB',
      date: '2024-12-14 09:15',
      status: 'processing',
      downloadUrl: null
    }
  ])

  const exportFormats = [
    {
      id: 'excel',
      name: 'Excel (XLSX)',
      icon: Table,
      description: 'Spreadsheet with multiple sheets and formulas',
      fileSize: '~2-5 MB'
    },
    {
      id: 'csv',
      name: 'CSV',
      icon: Database,
      description: 'Comma-separated values for data analysis',
      fileSize: '~500 KB - 2 MB'
    },
    {
      id: 'pdf',
      name: 'PDF Report',
      icon: FileText,
      description: 'Formatted report with charts and tables',
      fileSize: '~1-3 MB'
    },
    {
      id: 'json',
      name: 'JSON',
      icon: File,
      description: 'Structured data for API integration',
      fileSize: '~200 KB - 1 MB'
    },
    {
      id: 'png',
      name: 'PNG Images',
      icon: Image,
      description: 'High-resolution charts and visualizations',
      fileSize: '~500 KB - 2 MB'
    }
  ]

  const dataTypes = [
    {
      id: 'portfolio',
      name: 'Portfolio Summary',
      description: 'Overall portfolio metrics and KPIs',
      records: '~50 rows'
    },
    {
      id: 'revenue',
      name: 'Revenue Projections',
      description: '30-year revenue forecasts by asset',
      records: '~900 rows'
    },
    {
      id: 'assets',
      name: 'Asset Definitions',
      description: 'Technical and commercial asset data',
      records: '~25 rows'
    },
    {
      id: 'contracts',
      name: 'Contract Details',
      description: 'All PPA and offtake agreements',
      records: '~75 rows'
    },
    {
      id: 'finance',
      name: 'Financial Metrics',
      description: 'IRR, NPV, and financing assumptions',
      records: '~200 rows'
    },
    {
      id: 'scenarios',
      name: 'Scenario Results',
      description: 'Multi-scenario analysis outcomes',
      records: '~150 rows'
    }
  ]

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'processing':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'processing':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const toggleDataSelection = (dataId) => {
    setSelectedData(prev => 
      prev.includes(dataId) 
        ? prev.filter(id => id !== dataId)
        : [...prev, dataId]
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Exports</h1>
        <p className="text-gray-600">Export portfolio data and reports in multiple formats</p>
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <span className="text-blue-800 font-medium">Work in Progress</span>
          </div>
          <p className="text-blue-700 text-sm mt-2">
            This feature is under development. The interface shown below represents the planned functionality 
            for comprehensive data exports and report generation.
          </p>
        </div>
      </div>

      {/* Export Configuration */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Configure Export</h3>
          <p className="text-sm text-gray-600 mt-1">
            Select the data types and format for your export
          </p>
        </div>

        <div className="p-6">
          {/* Format Selection */}
          <div className="mb-8">
            <h4 className="text-sm font-semibold text-gray-900 mb-4">Export Format</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {exportFormats.map((format) => {
                const Icon = format.icon
                const isSelected = selectedFormat === format.id
                
                return (
                  <div
                    key={format.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedFormat(format.id)}
                  >
                    <div className="text-center">
                      <div className={`inline-flex p-3 rounded-lg mb-2 ${
                        isSelected ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <Icon className={`w-6 h-6 ${
                          isSelected ? 'text-green-600' : 'text-gray-600'
                        }`} />
                      </div>
                      <h5 className="font-semibold text-sm text-gray-900">{format.name}</h5>
                      <p className="text-xs text-gray-600 mt-1">{format.description}</p>
                      <p className="text-xs text-gray-500 mt-1">{format.fileSize}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Data Selection */}
          <div className="mb-8">
            <h4 className="text-sm font-semibold text-gray-900 mb-4">Data to Include</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dataTypes.map((dataType) => {
                const isSelected = selectedData.includes(dataType.id)
                
                return (
                  <div
                    key={dataType.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleDataSelection(dataType.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="font-semibold text-sm text-gray-900">{dataType.name}</h5>
                        <p className="text-xs text-gray-600 mt-1">{dataType.description}</p>
                        <p className="text-xs text-gray-500 mt-1">{dataType.records}</p>
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-green-500 ml-2" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Export Options */}
          <div className="mb-8">
            <h4 className="text-sm font-semibold text-gray-900 mb-4">Export Options</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time Period
                </label>
                <select className="w-full border border-gray-300 rounded-md px-3 py-2">
                  <option>All Time (30 years)</option>
                  <option>Next 10 years</option>
                  <option>2024-2030</option>
                  <option>Custom Range</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aggregation Level
                </label>
                <select className="w-full border border-gray-300 rounded-md px-3 py-2">
                  <option>Annual</option>
                  <option>Quarterly</option>
                  <option>Monthly</option>
                  <option>Asset-level detail</option>
                </select>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-gray-300 mr-2" defaultChecked />
                <span className="text-sm text-gray-700">Include charts and visualizations</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-gray-300 mr-2" defaultChecked />
                <span className="text-sm text-gray-700">Include metadata and assumptions</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-gray-300 mr-2" />
                <span className="text-sm text-gray-700">Password protect file</span>
              </label>
            </div>
          </div>

          {/* Export Actions */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Estimated file size: <span className="font-medium">2.8 MB</span>
              • Processing time: <span className="font-medium">~30 seconds</span>
            </div>
            <div className="flex space-x-3">
              <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                <Eye className="w-4 h-4" />
                <span>Preview</span>
              </button>
              <button className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Download className="w-4 h-4" />
                <span>Generate Export</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Export History */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Export History</h3>
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">Last 30 days</span>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            {exportHistory.map((export_) => (
              <div key={export_.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(export_.status)}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{export_.name}</h4>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>{export_.format}</span>
                      <span>{export_.size}</span>
                      <span>{export_.date}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(export_.status)}`}>
                    {export_.status}
                  </span>
                  
                  {export_.status === 'completed' && (
                    <>
                      <button className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-green-600 hover:bg-green-50 rounded">
                        <Download className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  
                  {export_.status === 'processing' && (
                    <button className="p-2 text-gray-600 hover:bg-gray-50 rounded">
                      <Clock className="w-4 h-4" />
                    </button>
                  )}
                  
                  <button className="p-2 text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Export Templates */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Quick Export Templates</h3>
          <p className="text-sm text-gray-600 mt-1">
            Pre-configured exports for common use cases
          </p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-gray-300 text-left">
              <FileText className="w-8 h-8 text-blue-500" />
              <div>
                <h4 className="font-medium text-gray-900">Investor Report</h4>
                <p className="text-sm text-gray-600">Portfolio summary + financial metrics</p>
              </div>
            </button>

            <button className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-gray-300 text-left">
              <Table className="w-8 h-8 text-green-500" />
              <div>
                <h4 className="font-medium text-gray-900">Data Backup</h4>
                <p className="text-sm text-gray-600">Complete portfolio data export</p>
              </div>
            </button>

            <button className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-gray-300 text-left">
              <Cloud className="w-8 h-8 text-purple-500" />
              <div>
                <h4 className="font-medium text-gray-900">API Integration</h4>
                <p className="text-sm text-gray-600">JSON format for external systems</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Status Footer */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Download className="w-5 h-5 text-orange-500" />
            <span className="text-orange-800 font-medium">
              Export Module - Development Preview
            </span>
          </div>
          <div className="text-orange-600 text-sm">
            Coming Soon: Scheduled exports, cloud storage integration, custom templates
          </div>
        </div>
        <div className="mt-2 text-sm text-orange-700">
          This will enable automated data exports on schedules, direct integration with cloud storage services, 
          and custom export templates for different stakeholder requirements.
        </div>
      </div>
    </div>
  )
}