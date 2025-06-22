import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from './forecastCalculations';

const BalanceSheet = ({ forecastData, years }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Statement of Financial Position (AASB 101)</CardTitle>
        <p className="text-sm text-gray-600">All figures in AUD millions</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-64">As at 30 June</TableHead>
                {years.map(year => (
                  <TableHead key={year} className="text-right">{year}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-blue-50 font-semibold">
                <TableCell>ASSETS</TableCell>
                <TableCell></TableCell>
              </TableRow>
              
              <TableRow className="font-medium">
                <TableCell className="pl-4">Current assets</TableCell>
                <TableCell></TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-8">Cash and cash equivalents</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.cashAndBankBalances)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-8">Trade and other receivables</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.accountsReceivable)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="font-medium">
                <TableCell className="pl-4">Total current assets</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.totalCurrentAssets)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="font-medium">
                <TableCell className="pl-4">Non-current assets</TableCell>
                <TableCell></TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-8">Property, plant and equipment</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.propertyPlantEquipment)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="font-medium">
                <TableCell className="pl-4">Total non-current assets</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.totalNonCurrentAssets)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="bg-blue-100 font-bold border-t-2">
                <TableCell>TOTAL ASSETS</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.totalAssets)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="bg-red-50 font-semibold">
                <TableCell>LIABILITIES</TableCell>
                <TableCell></TableCell>
              </TableRow>
              
              <TableRow className="font-medium">
                <TableCell className="pl-4">Current liabilities</TableCell>
                <TableCell></TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-8">Trade and other payables</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.accountsPayable)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-8">Provisions</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.accruals)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="font-medium">
                <TableCell className="pl-4">Total current liabilities</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.totalCurrentLiabilities)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="font-medium">
                <TableCell className="pl-4">Non-current liabilities</TableCell>
                <TableCell></TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-8">Interest-bearing liabilities</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.longTermDebt)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="font-medium">
                <TableCell className="pl-4">Total non-current liabilities</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.totalNonCurrentLiabilities)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="font-bold">
                <TableCell>TOTAL LIABILITIES</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.totalLiabilities)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="bg-green-50 font-semibold">
                <TableCell>EQUITY</TableCell>
                <TableCell></TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-4">Share capital</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.shareCapital)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-4">Retained earnings</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.retainedEarnings)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="bg-green-100 font-bold border-t-2">
                <TableCell>TOTAL EQUITY</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.totalEquity)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="bg-blue-100 font-bold border-t-2">
                <TableCell>TOTAL EQUITY AND LIABILITIES</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.totalEquity + item.totalLiabilities)}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default BalanceSheet;