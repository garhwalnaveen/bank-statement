'use client';

import { useUser } from "@stackframe/stack";
import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Trash2, Plus, X, BookOpen, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface ClientData {
    id: string;
    name: string;
}

interface RuleData {
    id: string;
    pattern: string;
    matchType: string;
    ledgerName: string;
    transactionType: string;
    priority: number;
    createdAt: string;
}

export default function RulesPage() {
    const params = useParams<{ teamId: string }>();
    const user = useUser({ or: 'redirect' });
    const team = user.useTeam(params.teamId);

    const [clients, setClients] = useState<ClientData[]>([]);
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [rules, setRules] = useState<RuleData[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({ pattern: '', matchType: 'contains', ledgerName: '', transactionType: 'Receipt' });

    const fetchClientsAndRules = useCallback(async () => {
        if (!team) return;
        try {
            const res = await fetch(`/api/clients?teamId=${team.id}`);
            const data = await res.json();
            const clientList: ClientData[] = data.clients || [];
            setClients(clientList);

            // Immediately fetch rules for the first client — no extra render cycle
            if (clientList.length > 0) {
                const firstId = clientList[0].id;
                setSelectedClient(firstId);
                const rulesRes = await fetch(`/api/clients/${firstId}/rules?teamId=${team.id}`);
                const rulesData = await rulesRes.json();
                setRules(rulesData.rules || []);
            }
        } catch { /* ignore */ } finally {
            setLoading(false);
        }
    }, [team]);

    const fetchRules = useCallback(async (clientId: string) => {
        if (!team || !clientId) return;
        try {
            const res = await fetch(`/api/clients/${clientId}/rules?teamId=${team.id}`);
            const data = await res.json();
            setRules(data.rules || []);
        } catch { /* ignore */ }
    }, [team]);

    useEffect(() => { fetchClientsAndRules(); }, [fetchClientsAndRules]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!team || !selectedClient) return;
        setSaving(true);
        try {
            await fetch(`/api/clients/${selectedClient}/rules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamId: team.id, ...formData }),
            });
            setShowModal(false);
            setFormData({ pattern: '', matchType: 'contains', ledgerName: '', transactionType: 'Receipt' });
            fetchRules(selectedClient);
        } catch { /* ignore */ } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (ruleId: string) => {
        if (!team || !selectedClient || !confirm('Delete this rule?')) return;
        setDeleting(ruleId);
        try {
            await fetch(`/api/clients/${selectedClient}/rules?teamId=${team.id}&ruleId=${ruleId}`, { method: 'DELETE' });
            setRules(prev => prev.filter(r => r.id !== ruleId));
        } catch { /* ignore */ } finally {
            setDeleting(null);
        }
    };

    if (!team) return null;

    return (
        <div className="max-w-[1400px] mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[22px] font-bold text-zinc-900 dark:text-white tracking-tight">Narration Rules</h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Auto-assign ledgers based on transaction narration patterns</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    disabled={!selectedClient}
                    className={cn(buttonVariants({ size: "default" }), "rounded-lg text-sm font-semibold px-4 shadow-sm bg-primary hover:bg-primary/90 disabled:opacity-50")}
                >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Rule
                </button>
            </div>

            {/* Client selector */}
            {clients.length > 0 && (
                <div className="flex items-center gap-3">
                    <span className="text-[13px] font-medium text-zinc-500">Filter by Client:</span>
                    <select
                        value={selectedClient}
                        onChange={e => { setSelectedClient(e.target.value); fetchRules(e.target.value); }}
                        className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
                    >
                        {clients.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : clients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                    <BookOpen className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mb-3" />
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">No clients yet</h3>
                    <p className="text-xs text-zinc-500">Create a client first to manage rules</p>
                </div>
            ) : rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                    <Search className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mb-3" />
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">No rules yet</h3>
                    <p className="text-xs text-zinc-500 mb-4">Add rules or save from the transaction review page</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className={cn(buttonVariants({ size: "default" }), "rounded-lg text-sm font-semibold px-4 shadow-sm bg-primary hover:bg-primary/90")}
                    >
                        <Plus className="h-4 w-4 mr-1.5" />
                        Add Your First Rule
                    </button>
                </div>
            ) : (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="text-left px-5 py-3 font-semibold text-zinc-600 dark:text-zinc-400 text-[11px] uppercase tracking-wider">Pattern</th>
                                <th className="text-left px-5 py-3 font-semibold text-zinc-600 dark:text-zinc-400 text-[11px] uppercase tracking-wider">Match</th>
                                <th className="text-left px-5 py-3 font-semibold text-zinc-600 dark:text-zinc-400 text-[11px] uppercase tracking-wider">Ledger</th>
                                <th className="text-left px-5 py-3 font-semibold text-zinc-600 dark:text-zinc-400 text-[11px] uppercase tracking-wider">Type</th>
                                <th className="text-center px-5 py-3 font-semibold text-zinc-600 dark:text-zinc-400 text-[11px] uppercase tracking-wider w-16">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rules.map((rule, i) => (
                                <tr key={rule.id} className="border-b border-zinc-100 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                                    <td className="px-5 py-3.5 font-mono text-[13px] text-blue-600 dark:text-blue-400 font-medium">{rule.pattern}</td>
                                    <td className="px-5 py-3.5">
                                        <span className="px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-[11px] font-semibold bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                                            {rule.matchType}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5 text-[13px] font-medium text-zinc-900 dark:text-zinc-100">{rule.ledgerName}</td>
                                    <td className="px-5 py-3.5">
                                        <span className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${rule.transactionType === 'Receipt'
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                                            : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                                            }`}>
                                            {rule.transactionType}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5 text-center">
                                        <button
                                            onClick={() => handleDelete(rule.id)}
                                            disabled={deleting === rule.id}
                                            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-400 hover:text-red-600 transition-colors"
                                        >
                                            {deleting === rule.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add Rule Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm px-4">
                    <div className="bg-white dark:bg-zinc-950 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight">Add Rule</h2>
                            <button onClick={() => setShowModal(false)} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Narration Pattern *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.pattern}
                                    onChange={e => setFormData(d => ({ ...d, pattern: e.target.value }))}
                                    placeholder="e.g. SMS Alert charges"
                                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-zinc-400"
                                />
                            </div>
                            <div>
                                <label className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Match Type</label>
                                <select
                                    value={formData.matchType}
                                    onChange={e => setFormData(d => ({ ...d, matchType: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                >
                                    <option value="contains">Contains</option>
                                    <option value="exact">Exact Match</option>
                                    <option value="startsWith">Starts With</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Ledger Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.ledgerName}
                                    onChange={e => setFormData(d => ({ ...d, ledgerName: e.target.value }))}
                                    placeholder="e.g. Bank Charges"
                                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-zinc-400"
                                />
                            </div>
                            <div>
                                <label className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Transaction Type *</label>
                                <select
                                    value={formData.transactionType}
                                    onChange={e => setFormData(d => ({ ...d, transactionType: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                >
                                    <option value="Receipt">Receipt</option>
                                    <option value="Payment">Payment</option>
                                    <option value="Contra">Contra</option>
                                    <option value="Journal">Journal</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className={cn(buttonVariants({ variant: "outline", size: "default" }), "flex-1 rounded-lg font-semibold bg-white dark:bg-zinc-950 border-zinc-200 hover:bg-zinc-50")}>Cancel</button>
                                <button type="submit" disabled={saving} className={cn(buttonVariants({ size: "default" }), "flex-1 rounded-lg font-semibold shadow-sm bg-primary hover:bg-primary/90 disabled:opacity-50")}>
                                    {saving ? 'Saving...' : 'Create Rule'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
