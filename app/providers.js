'use client'

import ScenarioProvider from '@/contexts/ScenarioContext';
import PortfolioProvider from '@/contexts/PortfolioContext';

export default function Providers({ children }) {
  return (
    <ScenarioProvider>
      <PortfolioProvider>
        {children}
      </PortfolioProvider>
    </ScenarioProvider>
  );
}