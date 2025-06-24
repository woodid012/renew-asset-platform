'use client'

import { useState, useEffect } from 'react';
import { 
  Building2, 
  Zap, 
  TrendingUp, 
  BarChart3,
  Loader2,
  CheckCircle,
  Clock
} from 'lucide-react';

function LoadingPage({ currentUser, currentPortfolio }) {
  const [loadingStage, setLoadingStage] = useState('connecting');
  const [progress, setProgress] = useState(0);

  // Simulate loading stages for better UX
  useEffect(() => {
    const stages = [
      { stage: 'connecting', duration: 500, message: 'Connecting to database...' },
      { stage: 'portfolio', duration: 800, message: 'Loading portfolio data...' },
      { stage: 'assets', duration: 600, message: 'Loading asset configurations...' },
      { stage: 'calculations', duration: 700, message: 'Calculating metrics...' },
      { stage: 'complete', duration: 300, message: 'Almost ready...' }
    ];

    let currentStageIndex = 0;
    let currentProgress = 0;

    const updateStage = () => {
      if (currentStageIndex < stages.length) {
        const stage = stages[currentStageIndex];
        setLoadingStage(stage.stage);
        
        // Animate progress within this stage
        const stepSize = (100 / stages.length) / 20; // 20 steps per stage
        const interval = stage.duration / 20;
        
        const progressInterval = setInterval(() => {
          currentProgress += stepSize;
          setProgress(Math.min(currentProgress, (currentStageIndex + 1) * (100 / stages.length)));
        }, interval);

        setTimeout(() => {
          clearInterval(progressInterval);
          currentStageIndex++;
          updateStage();
        }, stage.duration);
      }
    };

    updateStage();
  }, []);

  const getStageIcon = (stage) => {
    switch (stage) {
      case 'connecting':
        return <Loader2 className="w-6 h-6 animate-spin text-blue-600" />;
      case 'portfolio':
        return <Building2 className="w-6 h-6 text-green-600" />;
      case 'assets':
        return <Zap className="w-6 h-6 text-yellow-600" />;
      case 'calculations':
        return <BarChart3 className="w-6 h-6 text-purple-600" />;
      case 'complete':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      default:
        return <Loader2 className="w-6 h-6 animate-spin text-gray-600" />;
    }
  };

  const getStageMessage = (stage) => {
    switch (stage) {
      case 'connecting':
        return 'Establishing secure connection to database...';
      case 'portfolio':
        return `Loading ${currentPortfolio?.portfolioId || 'portfolio'} data...`;
      case 'assets':
        return 'Loading asset configurations and contracts...';
      case 'calculations':
        return 'Calculating revenue projections and metrics...';
      case 'complete':
        return 'Finalizing dashboard data...';
      default:
        return 'Loading...';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        {/* Main Loading Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Header */}
          <div className="mb-8">
            <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              RenewableAssets
            </h1>
            <p className="text-gray-600">
              Loading your portfolio dashboard
            </p>
          </div>

          {/* User & Portfolio Info */}
          <div className="mb-8 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-blue-700">
                  {currentUser?.name?.charAt(0) || 'U'}
                </span>
              </div>
              <span className="font-medium text-gray-900">
                {currentUser?.name || 'User'}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              Portfolio: {currentPortfolio?.portfolioId || 'Loading...'}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-green-600 to-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Current Stage */}
          <div className="flex items-center justify-center space-x-3 mb-8">
            {getStageIcon(loadingStage)}
            <span className="text-gray-700 font-medium">
              {getStageMessage(loadingStage)}
            </span>
          </div>

          {/* Loading Stages List */}
          <div className="space-y-3">
            {[
              { key: 'connecting', label: 'Database Connection', icon: Loader2 },
              { key: 'portfolio', label: 'Portfolio Data', icon: Building2 },
              { key: 'assets', label: 'Asset Configurations', icon: Zap },
              { key: 'calculations', label: 'Revenue Calculations', icon: TrendingUp },
              { key: 'complete', label: 'Dashboard Ready', icon: CheckCircle }
            ].map((item, index) => {
              const Icon = item.icon;
              const isActive = loadingStage === item.key;
              const isComplete = progress > (index * 20);
              
              return (
                <div 
                  key={item.key}
                  className={`flex items-center space-x-3 p-2 rounded-lg transition-all duration-300 ${
                    isActive ? 'bg-blue-50 border border-blue-200' : 
                    isComplete ? 'bg-green-50' : 'bg-gray-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${
                    isActive ? 'text-blue-600 animate-pulse' :
                    isComplete ? 'text-green-600' : 'text-gray-400'
                  }`} />
                  <span className={`text-sm ${
                    isActive ? 'text-blue-900 font-medium' :
                    isComplete ? 'text-green-900' : 'text-gray-600'
                  }`}>
                    {item.label}
                  </span>
                  {isComplete && !isActive && (
                    <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />
                  )}
                  {isActive && (
                    <Clock className="w-4 h-4 text-blue-600 ml-auto animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            This may take a few moments for large portfolios
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoadingPage;