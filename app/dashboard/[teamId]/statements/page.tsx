'use client';

import { useUser } from "@stackframe/stack";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { FileText, Download, Trash2, CheckCircle2, AlertCircle, Loader2, Search, Calendar, Building2, ArrowUpDown, Eye } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface Statement {
    id: string;
    filename: string;
    uploadedAt: string;
    transactionCount: number;
    clientName: string | null;
    clientId: string | null;
    metadata: {
        bank: string | null;
        account_number: string | null;
        currency: string | null;
    };
    validation: {
        is_valid: boolean;
        accuracy_pct: number;
    } | null;
}

export default function StatementsPage() {
    const params = useParams<{ teamId: string }>();
    const user = useUser({ or: 'redirect' });
    const team = user.useTeam(params.teamId);
    const router = useRouter();

    const [statements, setStatements] = useState<Statement[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleting, setDeleting] = useState<string | null>(null);
    const [sortField, setSortField] = useState<'date' | 'name' | 'transactions'>('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const fetchStatements = useCallback(async () => {
        if (!team) return;
        try {
            const res = await fetch(`/api/statements?teamId=${team.id}`);
            const data = await res.json();
            setStatements(data.statements || []);
        } catch { /* ignore */ } finally {
            setLoading(false);
        }
    }, [team]);

    useEffect(() => { fetchStatements(); }, [fetchStatements]);

    const handleDelete = async (id: string) => {
        if (!team || !confirm('Delete this statement and all its transactions?')) return;
        setDeleting(id);
        try {
            await fetch(`/api/statements/${id}?teamId=${team.id}`, { method: 'DELETE' });
            setStatements(prev => prev.filter(s => s.id !== id));
        } catch { /* ignore */ } finally {
            setDeleting(null);
        }
    };

    if (!team) return null;

    const filtered = statements
        .filter(s => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return s.filename.toLowerCase().includes(q) ||
                (s.metadata?.bank || '').toLowerCase().includes(q) ||
                (s.clientName || '').toLowerCase().includes(q);
        })
        .sort((a, b) => {
            const dir = sortDir === 'asc' ? 1 : -1;
            if (sortField === 'date') return (new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()) * dir;
            if (sortField === 'name') return a.filename.localeCompare(b.filename) * dir;
            return (a.transactionCount - b.transactionCount) * dir;
        });

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('desc'); }
    };

    return (
        <div className="max-w-[1400px] mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-[22px] font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Bank Statements</h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        {statements.length} statement{statements.length !== 1 ? 's' : ''} uploaded
                    </p>
                </div>
                <Link
                    href={`/dashboard/${team.id}/upload`}
                    className={cn(buttonVariants({ size: "default" }), "rounded-lg text-sm font-semibold px-4 shadow-sm bg-primary hover:bg-primary/90 hidden md:flex")}
                >
                    Upload New
                </Link>
            </div>

            <div className="flex gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                        type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search by filename, bank, or client..."
                        className="w-full pl-9 pr-4 h-10 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                    />
                </div>
                <button onClick={() => toggleSort('date')}
                    className={`inline-flex items-center gap-1.5 px-3 h-10 rounded-lg border text-sm font-medium shadow-sm transition-colors ${sortField === 'date' ? 'border-primary/30 bg-primary/5 text-primary dark:border-primary/50' : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}>
                    <Calendar className="h-3.5 w-3.5" /> Date <ArrowUpDown className="h-3 w-3" />
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                    <FileText className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mb-3" />
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">
                        {searchQuery ? 'No results found' : 'No statements yet'}
                    </h3>
                    <p className="text-xs text-zinc-500">{searchQuery ? 'Try a different search' : 'Upload your first bank statement'}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(stmt => (
                        <div key={stmt.id}
                            className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 transition-all hover:border-primary/40 shadow-sm">
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 shrink-0">
                                    <FileText className="h-5 w-5 text-blue-500" />
                                </div>
                                <div className="flex-1 min-w-0 pt-0.5">
                                    <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{stmt.filename}</p>
                                    <div className="flex flex-wrap items-center gap-2.5 mt-1.5">
                                        {stmt.clientName && (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                                                <Building2 className="h-3 w-3 text-zinc-400" /> {stmt.clientName}
                                            </span>
                                        )}
                                        {stmt.metadata?.bank && (
                                            <span className="text-[13px] text-zinc-500 font-medium">{stmt.metadata.bank}</span>
                                        )}
                                        <span className="text-xs text-zinc-300 dark:text-zinc-700">•</span>
                                        <span className="text-[13px] text-zinc-500">{stmt.transactionCount} transactions</span>
                                        <span className="text-xs text-zinc-300 dark:text-zinc-700">•</span>
                                        <span className="text-[13px] text-zinc-500">{new Date(stmt.uploadedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 pt-1">
                                    {stmt.validation?.is_valid ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" /> Valid</span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-500/10 dark:text-amber-400"><AlertCircle className="h-3 w-3" /> Review</span>
                                    )}
                                    <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-1" />
                                    <button
                                        onClick={() => router.push(`/dashboard/${team.id}/transactions/${stmt.id}`)}
                                        className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-primary transition-colors"
                                        title="Review & Assign Ledgers"
                                    >
                                        <Eye className="h-4 w-4" />
                                    </button>
                                    <a
                                        href={`/api/statements/${stmt.id}/csv?teamId=${team.id}`}
                                        download
                                        className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-primary transition-colors"
                                        title="Download CSV"
                                    >
                                        <Download className="h-4 w-4" />
                                    </a>
                                    <button
                                        onClick={() => handleDelete(stmt.id)}
                                        disabled={deleting === stmt.id}
                                        className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-400 hover:text-red-600 transition-colors"
                                        title="Delete"
                                    >
                                        {deleting === stmt.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
