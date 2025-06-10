'use client';

export default function MarkToMarketTab() {
  return (
    <div className="bg-white rounded-xl p-6 lg:p-8 shadow-md border border-gray-200">
      <div className="text-center py-12 lg:py-16">
        <h2 className="text-2xl lg:text-3xl font-bold text-gray-800 mb-4">
          💹 Mark-to-Market Analysis
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          This feature is currently under development. Detailed mark-to-market
          calculations and visualizations will be available here soon.
        </p>
        <div className="mt-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    </div>
  );
}