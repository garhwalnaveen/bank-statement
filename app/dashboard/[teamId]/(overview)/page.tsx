'use client';

import { useUser } from "@stackframe/stack";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FileText, Upload, TrendingUp, Building2, CheckCircle2,
  ArrowRight, BookOpen, Search, Bell, Plus, Users,
  FileWarning, FileCheck, Clock, ChevronDown, Eye, SlidersHorizontal, MoreHorizontal
} from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function OverviewPage() {
  const params = useParams<{ teamId: string }>();
  const user = useUser({ or: 'redirect' });
  const team = user.useTeam(params.teamId);
  const [stats, setStats] = useState({ clients: 0, statements: 0, transactions: 0, rules: 0 });
  const [loading, setLoading] = useState(true);
  const [recentStatements, setRecentStatements] = useState<Array<{ id: string; filename: string; transactionCount: number; clientName: string | null; uploadedAt: string; metadata: { bank: string | null }; validation: { is_valid: boolean } | null }>>([]);

  useEffect(() => {
    if (!team) return;
    Promise.all([
      fetch(`/api/clients?teamId=${team.id}`).then(r => r.json()),
      fetch(`/api/statements?teamId=${team.id}`).then(r => r.json()),
    ]).then(([clientsData, statementsData]) => {
      const clients = clientsData.clients || [];
      const statements = statementsData.statements || [];
      const totalTxns = statements.reduce((s: number, st: { transactionCount: number }) => s + (st.transactionCount || 0), 0);
      const totalRules = clients.reduce((s: number, c: { _count?: { rules: number } }) => s + (c._count?.rules || 0), 0);
      setStats({ clients: clients.length, statements: statements.length, transactions: totalTxns, rules: totalRules });
      setRecentStatements(statements.slice(0, 5));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [team]);

  if (!team) return null;

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-[22px] font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
          Report Dashboard
        </h1>
        <button className={cn(buttonVariants({ size: "default" }), "rounded-lg text-sm font-medium px-4 shadow-sm bg-emerald-600 hover:bg-emerald-700 hidden md:flex")}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Report
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          {
            label: 'Total Clients', value: stats.clients || 248, icon: Users,
            iconBg: 'bg-blue-50 dark:bg-blue-500/10', iconColor: 'text-blue-500',
            badgeBg: 'bg-emerald-50 text-emerald-600', badgeIcon: '↗', badgeText: '12%', badgeDesc: 'vs last month'
          },
          {
            label: 'Pending Statements', value: stats.statements || 42, icon: FileWarning,
            iconBg: 'bg-amber-50 dark:bg-amber-500/10', iconColor: 'text-amber-500',
            badgeBg: 'bg-amber-50 text-amber-600', badgeIcon: '!', badgeText: 'High', badgeDesc: 'needs review'
          },
          {
            label: 'Processed Txns', value: loading ? '—' : `${(stats.transactions / 1000).toFixed(1)}k`, icon: FileCheck,
            iconBg: 'bg-emerald-50 dark:bg-emerald-500/10', iconColor: 'text-emerald-500',
            badgeBg: 'bg-emerald-50 text-emerald-600', badgeIcon: '↗', badgeText: '8%', badgeDesc: 'vs last month'
          },
          {
            label: 'Avg Sync Time', value: '1.2s', icon: Clock,
            iconBg: 'bg-purple-50 dark:bg-purple-500/10', iconColor: 'text-purple-500',
            badgeBg: 'bg-emerald-50 text-emerald-600', badgeIcon: '✔', badgeText: 'Optimal', badgeDesc: 'Performance'
          },
        ].map(({ label, value, icon: Icon, iconBg, iconColor, badgeBg, badgeIcon, badgeText, badgeDesc }) => (
          <div key={label} className="rounded-xl border border-zinc-200 bg-white dark:bg-zinc-950 dark:border-zinc-800/50 p-5 shadow-sm transition-all hover:-translate-y-1">
            <div className="flex items-start justify-between mb-2">
              <span className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
              <div className={`p-2 rounded-lg ${iconBg}`}>
                <Icon className={`h-4 w-4 ${iconColor}`} />
              </div>
            </div>
            <p className="text-3xl font-bold text-zinc-900 dark:text-white mb-6">
              {value}
            </p>
            <div className="flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold ${badgeBg} dark:bg-opacity-10 dark:border dark:border-emerald-500/20`}>
                {badgeIcon} {badgeText}
              </span>
              <span className="text-[11px] text-zinc-400">{badgeDesc}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Middle Charts Placeholder Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="rounded-xl border border-zinc-200 bg-white dark:bg-zinc-950 dark:border-zinc-800/50 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-semibold text-zinc-900 dark:text-white">Statement Status</h3>
            <MoreHorizontal className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
          </div>
          <div className="flex flex-col items-center justify-center h-48 relative">
            {/* Simple CSS Donut placeholder */}
            <div className="w-40 h-40 rounded-full border-[20px] border-emerald-500 border-r-blue-500 border-l-amber-500 border-b-red-500 flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">890</p>
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Total</p>
              </div>
            </div>
          </div>
          <div className="flex justify-between mt-8 gap-2">
            <div className="flex-1 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 p-2 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1 text-xs text-zinc-500"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Done</div>
              <p className="font-bold text-zinc-900 dark:text-white">65%</p>
            </div>
            <div className="flex-1 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 p-2 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1 text-xs text-zinc-500"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" />Pending</div>
              <p className="font-bold text-zinc-900 dark:text-white">20%</p>
            </div>
            <div className="flex-1 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 p-2 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1 text-xs text-zinc-500"><div className="w-1.5 h-1.5 rounded-full bg-red-500" />Error</div>
              <p className="font-bold text-zinc-900 dark:text-white">15%</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-zinc-200 bg-white dark:bg-zinc-950 dark:border-zinc-800/50 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-white">Monthly Upload Volume</h3>
              <p className="text-sm text-zinc-500">Document processing trends over the last 6 months</p>
            </div>
            <button className="flex items-center gap-2 text-xs font-medium text-zinc-600 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-md px-3 py-1.5 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800">
              Last 6 Months <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <div className="flex items-end h-56 mt-8 gap-8 px-4 relative">
            <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[10px] text-zinc-400 font-medium pb-2 border-r border-zinc-100 dark:border-zinc-800 pr-2">
              <span>2.5k</span><span>2.0k</span><span>1.5k</span><span>1.0k</span><span>0.5k</span><span>0</span>
            </div>
            <div className="flex-1 ml-10 flex items-end justify-between h-52 pb-6 border-b border-zinc-100 dark:border-zinc-800">
              {['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map((month, i) => (
                <div key={month} className="flex flex-col items-center gap-2 w-16 relative group">
                  {i === 5 ? (
                    <div className="absolute -top-7 whitespace-nowrap bg-zinc-800 text-white text-[10px] font-medium px-2 py-1 rounded shadow-lg z-10">
                      2,125 docs
                    </div>
                  ) : null}
                  <div className={`w-full rounded-sm ${i === 5 ? 'bg-emerald-500' : 'bg-emerald-500/30 dark:bg-emerald-500/20'} hover:bg-emerald-500 dark:hover:bg-emerald-500 transition-colors cursor-pointer`} style={{ height: i === 5 ? '100%' : '90%' }} />
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{month}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Client Activity Table */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:bg-zinc-950 dark:border-zinc-800/50 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800/50 flex items-center justify-between bg-white dark:bg-zinc-950">
          <h3 className="font-bold text-[17px] text-zinc-900 dark:text-white">Client Activity</h3>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 text-sm font-medium text-zinc-600 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-md px-3 py-1.5 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 transition-colors">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter
            </button>
            <button className="text-sm font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 dark:hover:bg-emerald-500/20 rounded-md px-3 py-1.5 transition-colors">
              Export Report
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800/50">
              <tr>
                <th className="px-5 py-4">Client Name</th>
                <th className="px-5 py-4">Statement Period</th>
                <th className="px-5 py-4">Upload Date</th>
                <th className="px-5 py-4">Tally Sync</th>
                <th className="px-5 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {[
                { name: 'Apex Tech Solutions', id: '#CL-8921', period: 'Oct 2023', date: 'Oct 24, 2023', sync: 'Synced', color: 'emerald' },
                { name: 'Green Leaf Logistics', id: '#CL-3321', period: 'Sep 2023', date: 'Oct 23, 2023', sync: 'Processing', color: 'blue' },
                { name: 'Sunrise Ventures', id: '#CL-1102', period: 'Oct 2023', date: 'Oct 22, 2023', sync: 'Error', color: 'amber' },
                { name: 'Northern Builders', id: '#CL-4401', period: 'Sep 2023', date: 'Oct 21, 2023', sync: 'Synced', color: 'teal' },
              ].map((client, i) => (
                <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors bg-white dark:bg-zinc-950">
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-md bg-${client.color}-500 flex items-center justify-center text-white font-bold text-xs shadow-sm`}>
                        {client.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">{client.name}</p>
                        <p className="text-xs text-zinc-400">ID: {client.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap font-medium text-zinc-700 dark:text-zinc-300">{client.period}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-zinc-500">{client.date}</td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    {client.sync === 'Synced' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {client.sync}
                      </span>
                    )}
                    {client.sync === 'Processing' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> {client.sync}
                      </span>
                    )}
                    {client.sync === 'Error' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" /> {client.sync}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-right">
                    <button className="text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
