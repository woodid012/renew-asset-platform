'use client';

import './globals.css';

// Import your context providers
import ScenarioProvider from '@/contexts/ScenarioContext';
import PortfolioProvider from '@/contexts/PortfolioContext';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>Portfolio Manager</title>
        <meta name="description" content="Energy Asset Performance Analysis Platform" />
      </head>
      <body>
        <ScenarioProvider>
          <PortfolioProvider>
            {children}
          </PortfolioProvider>
        </ScenarioProvider>
      </body>
    </html>
  );
}