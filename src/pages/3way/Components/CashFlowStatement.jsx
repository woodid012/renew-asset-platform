import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from './forecastCalculations';

const CashFlowStatement = ({ forecastData, years }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Statement of Cash Flows (AASB 107)</CardTitle>
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
              <TableRow className="bg-blue-50 font-semibold">
                <TableCell>CASH FLOWS FROM OPERATING ACTIVITIES</TableCell>
                <TableCell></TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-4">Receipts from customers</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.grossRevenue)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-4">Payments to suppliers and employees</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(-item.totalOperatingExpenses)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-4">Interest paid</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(-item.interestExpense)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-4">Income tax paid</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(-item.taxExpense)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="font-semibold bg-blue-100">
                <TableCell>Net cash provided by operating activities</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.operatingCashFlow)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="bg-green-50 font-semibold">
                <TableCell>CASH FLOWS FROM INVESTING ACTIVITIES</TableCell>
                <TableCell></TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-4">Purchase of property, plant and equipment</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.investingCashFlow)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="font-semibold bg-green-100">
                <TableCell>Net cash used in investing activities</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.investingCashFlow)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="bg-red-50 font-semibold">
                <TableCell>CASH FLOWS FROM FINANCING ACTIVITIES</TableCell>
                <TableCell></TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-4">Proceeds from borrowings</TableCell>
                {forecastData.map((item, index) => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(index === 0 ? item.longTermDebt : 0)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-4">Repayment of borrowings</TableCell>
                {forecastData.map((item, index) => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(index > 0 ? -item.principalRepayment : 0)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-4">Proceeds from share issue</TableCell>
                {forecastData.map((item, index) => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(index === 0 ? item.shareCapital : 0)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-4">Dividends paid</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(-item.dividendsPaid)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="font-semibold bg-red-100">
                <TableCell>Net cash provided by/(used in) financing activities</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.financingCashFlow)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="font-bold">
                <TableCell>Net increase/(decrease) in cash held</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.netCashFlow)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow>
                <TableCell className="pl-4">Cash at beginning of year</TableCell>
                {forecastData.map((item, index) => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(index === 0 ? 0 : forecastData[index-1].cumulativeCashFlow)}
                  </TableCell>
                ))}
              </TableRow>
              
              <TableRow className="bg-blue-100 font-bold border-t-2">
                <TableCell>Cash at end of year</TableCell>
                {forecastData.map(item => (
                  <TableCell key={item.year} className="text-right">
                    {formatCurrency(item.cumulativeCashFlow)}
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

export default CashFlowStatement;