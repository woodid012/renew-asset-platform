import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from './forecastCalculations';

const ProfitLossStatement = ({ forecastData, years }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Statement of Comprehensive Income (AASB 101)</CardTitle>
        <p className="text-sm text-gray-600">All figures in AUD millions</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-64">Financial Year Ending 30 June</TableHead>
                {years.map(year => (
                  <TableHead key={year} className="text-right">{year}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-blue-50">
                <TableCell className="font-semibold">REVENUE</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right font-medium">
                    {formatCurrency(item.grossRevenue)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-4">Revenue from contracts with customers</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.grossRevenue)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="bg-red-50">
                <TableCell className="font-semibold">EXPENSES</TableCell>
                <TableCell></TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-4">Asset operating expenses</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(-item.totalOperatingExpenses)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="bg-green-50 font-semibold">
                <TableCell>EBITDA</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.ebitda)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-4">Depreciation and amortisation</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(-item.annualDepreciation)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="font-semibold">
                <TableCell>EBIT</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.ebit)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-4">Finance costs</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(-item.interestExpense)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="font-semibold">
                <TableCell>Profit before income tax</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.profitBeforeTax)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-4">Income tax expense</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(-item.taxExpense)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="bg-blue-100 font-bold border-t-2">
                <TableCell>Net profit after tax</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.netProfitAfterTax)}
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

export default ProfitLossStatement;