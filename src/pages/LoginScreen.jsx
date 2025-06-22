import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Lock, User } from 'lucide-react';
import { cn } from "@/lib/utils";
import { TabsContent } from '@/components/ui/tabs';

// Import the shared Navigation component and tabs config
import Navigation from '@/components/shared/Navigation';

// Define users with their credentials and default portfolios
const USERS = {
  'ZEBRE': {
    password: '**',
    portfolioFile: 'zebre_2025-01-13.json',
    portfolioId: 'zebre',
    portfolioName: 'ZEBRE'
  },
  'AULA': {
    password: '**',
    portfolioFile: 'aula_2025-01-13.json',
    portfolioId: 'aula',
    portfolioName: 'Aula'
  },
  'ACCIONA': {
    password: '**',
    portfolioFile: 'acciona_merchant_2025-01-13.json',
    portfolioId: 'acciona',
    portfolioName: 'Acciona Merchant'
  }
};

const LoginScreen = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    const user = USERS[username.toUpperCase()];
    if (user && password === user.password) {
      // Store user info in session storage for the app to use
      sessionStorage.setItem('currentUser', username.toUpperCase());
      sessionStorage.setItem('userPortfolioFile', user.portfolioFile);
      sessionStorage.setItem('userPortfolioId', user.portfolioId);
      sessionStorage.setItem('userPortfolioName', user.portfolioName);
      
      onLogin();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  const date = new Date();
  const formattedDate = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;

  return (
    <Navigation
      activeTab="landingpage"
      onTabChange={() => {}}
      disabled={true}
      formattedDate={formattedDate}
    >
      <TabsContent value="landingpage">
        <Card className="p-3">
          <div className="h-64 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <h3 className="text-xl font-medium mb-2">Portfolio Analysis Dashboard</h3>
              <p>Application content will appear here after login</p>
            </div>
          </div>
        </Card>
      </TabsContent>

      {/* Login Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="absolute inset-0 bg-black opacity-50"></div>
        <Card className="w-full max-w-md relative z-10">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <Lock className="h-12 w-12 text-blue-500" />
            </div>
            <CardTitle className="text-2xl font-bold text-center">Portfolio Earnings Platform</CardTitle>
            <p className="text-center text-gray-500">Please enter your credentials</p>
            <div className="text-center text-xs text-gray-400 mt-2">
              Available users: ZEBRE, AULA, ACCIONA (password: **)
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <User className="h-4 w-4 text-gray-400" />
                    </div>
                    <Input
                      id="username"
                      type="text"
                      placeholder="Enter username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Lock className="h-4 w-4 text-gray-400" />
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={cn("pl-10", error ? "border-red-500" : "")}
                    />
                  </div>
                  {error && (
                    <p className="text-red-500 text-sm">Invalid username or password. Please try again.</p>
                  )}
                </div>
                <Button type="submit" className="w-full">Login</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Navigation>
  );
};

export default LoginScreen;