
import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export function MonthlyComplaintTrends({ data = [] }) {
  return (
    <section className="rounded-2xl border border-[#232427] bg-[#151618] p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-[#F4F4F5]">
          Monthly Complaint Trends
        </h2>
        <p className="text-sm text-[#71717A]">
          Complaints received vs. resolved over the last 6 months
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#232427"
          />
          <XAxis
            dataKey="month"
            tick={{ fill: '#A1A1AA', fontSize: 12 }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: '#A1A1AA', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0F1011',
              borderColor: '#232427',
              color: '#F4F4F5',
              borderRadius: 12,
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="received"
            name="Received"
            stroke="#00E676"
            strokeWidth={3}
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="resolved"
            name="Resolved"
            stroke="#6C7BFF"
            strokeWidth={3}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
