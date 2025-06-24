// app/components/LoadingPage.js - Enhanced with stage and progress props
'use client'

import { useState, useEffect } from 'react';
import { 
  Building2, 
  Zap, 
  TrendingUp, 
  BarChart3,
  Loader2,
  CheckCircle,
  Clock,
  Database,
  Settings,
  Calculator
} from 'lucide-react';

function LoadingPage({ currentUser, currentPortfolio, stage = 'connecting', progress = 0 }) {
  const [animatedProgress, setAnimatedProgress] = useState(0);

  // Animate progress changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progress);
    }, 100);
    return () => clearTimeout(timer);
  }, [progress]);

  const getStageIcon = (currentStage) => {
    switch (currentStage) {
      case 'connecting':
        return <Database className="w-6 h-6 animate-pulse text-blue-600" />;
      case 'portfolio':
        return <Building2 className="w-6 h-6 text-green-600" />;
      case 'assets':
        return <Zap className="w-6 h-6 text-yellow-600" />;
      case 'calculations':
        return <Calculator className="w-6 h-6 text-purple-600" />;
      case 'complete':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      default:
        return <Loader2 className="w-6 h-6 animate-spin text-gray-600" />;
    }
  };

  const getStageMessage = (currentStage) => {
    switch (currentStage) {
      case 'connecting':
        return 'Establishing secure connection to database...';
      case 'portfolio':
        return `Loading ${currentPortfolio?.portfolioId || 'portfolio'} data...`;
      case 'assets':
        return 'Loading asset configurations and contracts...';
      case 'calculations':
        return 'Calculating revenue projections and financial metrics...';
      case 'complete':
        return 'Finalizing dashboard data...';
      default:
        return 'Initializing platform...';
    }
  };

  const getStageDescription = (currentStage) => {
    switch (currentStage) {
      case 'connecting':
        return 'Verifying database connectivity and user authentication';
      case 'portfolio':
        return 'Retrieving portfolio configuration, assets, and settings';
      case 'assets':
        return 'Processing asset definitions, contracts, and technical parameters';
      case 'calculations':
        return 'Running financial models and generating performance projections';
      case 'complete':
        return 'Preparing interactive dashboard and visualizations';
      default:
        return 'Setting up your renewable energy portfolio analysis platform';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center">
      <div className="max-w-lg w-full mx-4">
        {/* Main Loading Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          {/* Header */}
          <div className="mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-green-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 relative overflow-hidden">
              <Building2 className="w-10 h-10 text-white relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-white opacity-20"></div>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-2">
              RenewableAssets
            </h1>
            <p className="text-gray-600 text-lg">
              Portfolio Analysis Platform
            </p>
          </div>

          {/* User & Portfolio Info */}
          {currentUser && currentPortfolio && (
            <div className="mb-8 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border">
              <div className="flex items-center justify-center space-x-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-white">
                    {currentUser?.name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">
                    {currentUser?.name || 'User'}
                  </div>
                  <div className="text-sm text-gray-600">
                    {currentUser?.company && `${currentUser.company} • `}
                    {currentPortfolio?.portfolioId || 'Loading...'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Current Stage Display */}
          <div className="mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              {getStageIcon(stage)}
              <div className="text-left">
                <div className="font-semibold text-gray-900 text-lg">
                  {getStageMessage(stage)}
                </div>
                <div className="text-sm text-gray-600 max-w-sm">
                  {getStageDescription(stage)}
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">Initialization Progress</span>
              <span className="text-sm font-bold text-gray-900">{Math.round(animatedProgress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 h-3 rounded-full transition-all duration-700 ease-out relative"
                style={{ width: `${animatedProgress}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Loading Stages Progress */}
          <div className="space-y-3 mb-8">
            {[
              { key: 'connecting', label: 'Database Connection', icon: Database, threshold: 20 },
              { key: 'portfolio', label: 'Portfolio Data', icon: Building2, threshold: 40 },
              { key: 'assets', label: 'Asset Configuration', icon: Zap, threshold: 60 },
              { key: 'calculations', label: 'Financial Analysis', icon: Calculator, threshold: 85 },
              { key: 'complete', label: 'Dashboard Ready', icon: CheckCircle, threshold: 100 }
            ].map((item, index) => {
              const Icon = item.icon;
              const isActive = stage === item.key;
              const isComplete = animatedProgress >= item.threshold;
              const isUpcoming = animatedProgress < item.threshold;
              
              return (
                <div 
                  key={item.key}
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-500 ${
                    isActive ? 'bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 shadow-sm' : 
                    isComplete ? 'bg-green-50 border border-green-200' : 
                    'bg-gray-50 border border-gray-100'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${
                    isActive ? 'bg-blue-500 shadow-lg' :
                    isComplete ? 'bg-green-500' : 'bg-gray-300'
                  }`}>
                    <Icon className={`w-4 h-4 ${
                      isActive ? 'text-white animate-pulse' :
                      isComplete ? 'text-white' : 'text-gray-500'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <span className={`text-sm font-medium ${
                      isActive ? 'text-blue-900' :
                      isComplete ? 'text-green-900' : 'text-gray-600'
                    }`}>
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center">
                    {isComplete && !isActive && (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    )}
                    {isActive && (
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    )}
                    {isUpcoming && (
                      <Clock className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Performance Indicators */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <div className="text-xs text-gray-600">Revenue Models</div>
              <div className={`text-sm font-semibold ${
                animatedProgress >= 60 ? 'text-green-600' : 'text-gray-400'
              }`}>
                {animatedProgress >= 60 ? 'Active' : 'Pending'}
              </div>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-xs text-gray-600">Analytics</div>
              <div className={`text-sm font-semibold ${
                animatedProgress >= 80 ? 'text-blue-600' : 'text-gray-400'
              }`}>
                {animatedProgress >= 80 ? 'Ready' : 'Loading'}
              </div>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Settings className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-xs text-gray-600">Platform</div>
              <div className={`text-sm font-semibold ${
                animatedProgress >= 95 ? 'text-purple-600' : 'text-gray-400'
              }`}>
                {animatedProgress >= 95 ? 'Online' : 'Starting'}
              </div>
            </div>
          </div>

          {/* Loading Tips */}
          {animatedProgress < 100 && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
              <div className="text-xs text-blue-800 font-medium mb-1">
                💡 Did you know?
              </div>
              <div className="text-sm text-blue-700">
                {stage === 'connecting' && "We're using enterprise-grade security to protect your portfolio data"}
                {stage === 'portfolio' && "Your portfolio configuration includes all asset definitions and contracts"}
                {stage === 'assets' && "Each asset's performance is calculated using real market price curves"}
                {stage === 'calculations' && "Financial models include debt sizing, cash flows, and sensitivity analysis"}
                {stage === 'complete' && "Interactive charts and reports are being prepared for your review"}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            {animatedProgress < 100 ? 
              "This may take a few moments for large portfolios with complex structures" :
              "Initialization complete! Redirecting to dashboard..."
            }
          </p>
          <div className="mt-2 flex items-center justify-center space-x-2 text-xs text-gray-400">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span>Secure Connection Established</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoadingPage;