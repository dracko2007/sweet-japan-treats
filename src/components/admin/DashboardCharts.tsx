import React from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// Gráficos do Dashboard em arquivo à parte: a biblioteca de gráficos (~350 KB)
// só baixa quando a seção "Gráficos & Rankings" é aberta, não ao abrir o painel.

export interface MonthlyFinancePoint {
  month: string;
  receitaComFrete: number;
  receitaSemFrete: number;
  custo: number;
  lucro: number;
}

export interface StatusSlice {
  name: string;
  value: number;
  color: string;
}

export const MonthlyFinanceChart: React.FC<{ data: MonthlyFinancePoint[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={280}>
    <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="month" />
      <YAxis tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
      <Tooltip formatter={(value) => (typeof value === 'number' ? `¥${value.toLocaleString()}` : value)} />
      <Legend />
      <Bar dataKey="receitaComFrete" name="Receita c/ frete" fill="#fbcfe8" radius={[4, 4, 0, 0]} />
      <Bar dataKey="receitaSemFrete" name="Receita s/ frete" fill="#ec4899" radius={[4, 4, 0, 0]} />
      <Bar dataKey="custo" name="Custo" fill="#9ca3af" radius={[4, 4, 0, 0]} />
      <Bar dataKey="lucro" name="Lucro" fill="#22c55e" radius={[4, 4, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
);

export const OrderStatusPie: React.FC<{ data: StatusSlice[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={200}>
    <PieChart>
      <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} label>
        {data.map((entry) => (
          <Cell key={entry.name} fill={entry.color} />
        ))}
      </Pie>
      <Tooltip />
    </PieChart>
  </ResponsiveContainer>
);
