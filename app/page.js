import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Portfolio Manager
          </h1>
          <p className="text-xl text-gray-600">
            Energy Asset Performance Analysis Platform
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-green-700">
              ✅ Next.js Setup Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">Ready to Import</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Asset Dashboard</li>
                  <li>• Portfolio Inputs</li>
                  <li>• Revenue Charts</li>
                  <li>• Risk Analysis</li>
                </ul>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">Features Available</h3>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Scenario Manager</li>
                  <li>• Export Tables</li>
                  <li>• 3-Way Forecast</li>
                  <li>• Portfolio Settings</li>
                </ul>
              </div>
            </div>

            <div className="text-center pt-4 border-t">
              <p className="text-sm text-gray-500">
                Ready to start importing your existing components!
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-800 mb-2">Next Steps:</h3>
          <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
            <li>Copy your src/ folder from the Vite project</li>
            <li>Move public/ assets (CSV, JSON files)</li>
            <li>Create page wrappers for each route</li>
            <li>Update Navigation component</li>
            <li>Test and iterate!</li>
          </ol>
        </div>
      </div>
    </div>
  );
}