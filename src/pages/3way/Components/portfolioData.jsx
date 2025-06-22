// Mock data structure - in real implementation, this would come from your portfolio context
export const mockPortfolioData = {
  assets: {
    '1': {
      id: '1',
      name: 'Solar Farm A',
      type: 'solar',
      capacity: 100,
      assetStartDate: '2025-01-01',
      assetLife: 30,
      state: 'NSW'
    },
    '2': {
      id: '2',
      name: 'Wind Farm B',
      type: 'wind',
      capacity: 150,
      assetStartDate: '2025-06-01',
      assetLife: 25,
      state: 'VIC'
    }
  },
  constants: {
    analysisStartYear: 2025,
    analysisEndYear: 2034,
    corporateTaxRate: 30,
    deprecationPeriods: {
      solar: 30,
      wind: 25,
      storage: 20
    },
    assetCosts: {
      'Solar Farm A': {
        capex: 120,
        operatingCosts: 1.4,
        operatingCostEscalation: 2.5,
        terminalValue: 15,
        maxGearing: 0.7,
        interestRate: 0.06,
        tenorYears: 20
      },
      'Wind Farm B': {
        capex: 375,
        operatingCosts: 6.0,
        operatingCostEscalation: 2.5,
        terminalValue: 30,
        maxGearing: 0.7,
        interestRate: 0.06,
        tenorYears: 18
      }
    },
    platformOpex: 4.2,
    platformOpexEscalation: 2.5,
    dividendPolicy: 85,
    minimumCashBalance: 5.0
  }
};