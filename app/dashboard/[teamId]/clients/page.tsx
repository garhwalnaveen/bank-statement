'use client';

import { useUser } from "@stackframe/stack";
import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Building2, Plus, Trash2, Edit2, RefreshCw, Loader2, BookOpen, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface ClientData {
    id: string;
    name: string;
    tallyCompanyName: string | null;
    bankName: string | null;
    createdAt: string;
    _count: { ledgers: number; rules: number; statements: number };
}

export default function ClientsPage() {
    const params = useParams<{ teamId: string }>();
    const user = useUser({ or: 'redirect' });
    const team = user.useTeam(params.teamId);

    const [clients, setClients] = useState<ClientData[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingClient, setEditingClient] = useState<ClientData | null>(null);
    const [formData, setFormData] = useState({ name: '', tallyCompanyName: '', bankName: '' });
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    const fetchClients = useCallback(async () => {
        if (!team) return;
        try {
            const res = await fetch(`/api/clients?teamId=${team.id}`);
            const data = await res.json();
            setClients(data.clients || []);
        } catch { /* ignore */ } finally {
            setLoading(false);
        }
    }, [team]);

    useEffect(() => { fetchClients(); }, [fetchClients]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!team) return;
        setSaving(true);

        try {
            const url = editingClient
                ? `/api/clients/${editingClient.id}`
                : '/api/clients';
            const method = editingClient ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamId: team.id, ...formData }),
            });
            if (res.ok) {
                closeModal();
                fetchClients();
            }
        } catch { /* ignore */ } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!team || !confirm('Delete this client and all its data?')) return;
        setDeleting(id);
        try {
            await fetch(`/api/clients/${id}?teamId=${team.id}`, { method: 'DELETE' });
            setClients(prev => prev.filter(c => c.id !== id));
        } catch { /* ignore */ } finally {
            setDeleting(null);
        }
    };

    const handleSyncLedgers = async (clientId: string) => {
        if (!team) return;
        setSyncing(clientId);
        try {
            const res = await fetch(`/api/clients/${clientId}/sync-ledgers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamId: team.id, useMock: true }),
            });
            const data = await res.json();
            if (res.ok) {
                alert(`Synced ${data.totalLedgers} ledgers (${data.created} new, ${data.updated} updated)`);
                fetchClients();
            } else {
                alert(data.error || 'Sync failed');
            }
        } catch { /* ignore */ } finally {
            setSyncing(null);
        }
    };

    const openModal = (client?: ClientData) => {
        if (client) {
            setEditingClient(client);
            setFormData({
                name: client.name,
                tallyCompanyName: client.tallyCompanyName || '',
                bankName: client.bankName || ''
            });
        } else {
            setEditingClient(null);
            setFormData({ name: '', tallyCompanyName: '', bankName: '' });
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingClient(null);
        setFormData({ name: '', tallyCompanyName: '', bankName: '' });
    };

    if (!team) return null;

    return (
        <div className="max-w-[1400px] mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[22px] font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Client Companies</h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Manage your Tally companies and their ledger accounts
                    </p>
                </div>
                <button
                    onClick={() => openModal()}
                    className={cn(buttonVariants({ size: "default" }), "rounded-lg text-sm font-semibold px-4 shadow-sm bg-primary hover:bg-primary/90")}
                >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Client
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : clients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                    <Building2 className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mb-3" />
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">No clients yet</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Add your first Tally company to get started</p>
                    <button
                        onClick={() => openModal()}
                        className={cn(buttonVariants({ size: "default" }), "rounded-lg text-sm font-semibold px-4 shadow-sm bg-primary hover:bg-primary/90")}
                    >
                        <Plus className="h-4 w-4 mr-1.5" />
                        Add Client
                    </button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {clients.map(client => (
                        <div key={client.id} className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-sm transition-all hover:border-primary/40">
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 shrink-0">
                                        <Building2 className="h-5 w-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-zinc-900 dark:text-white text-[15px]">{client.name}</h3>
                                        <div className="flex flex-col gap-0.5 mt-1">
                                            {client.tallyCompanyName && (
                                                <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                                                    Tally: <span className="text-zinc-700 dark:text-zinc-300 ml-1">{client.tallyCompanyName}</span>
                                                </p>
                                            )}
                                            {client.bankName && (
                                                <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                                                    Bank: <span className="text-zinc-700 dark:text-zinc-300 ml-1">{client.bankName}</span>
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 mt-3">
                                            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                                                <BookOpen className="h-3.5 w-3.5 text-zinc-400" />
                                                {client._count.ledgers} ledgers
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                                                <FileText className="h-3.5 w-3.5 text-zinc-400" />
                                                {client._count.statements} statements
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleSyncLedgers(client.id)}
                                        disabled={syncing === client.id}
                                        className="p-2 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-zinc-400 hover:text-emerald-600 transition-colors"
                                        title="Sync Ledgers"
                                    >
                                        {syncing === client.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <RefreshCw className="h-4 w-4" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => openModal(client)}
                                        className="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-primary transition-colors"
                                        title="Edit"
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(client.id)}
                                        disabled={deleting === client.id}
                                        className="p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-400 hover:text-red-600 transition-colors"
                                        title="Delete"
                                    >
                                        {deleting === client.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm px-4">
                    <div className="bg-white dark:bg-zinc-950 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight">
                                {editingClient ? 'Edit Client' : 'Add New Client'}
                            </h2>
                            <button onClick={closeModal} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                    Company Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-zinc-400"
                                    placeholder="e.g. Hinsons Carbons Pvt Ltd"
                                />
                            </div>
                            <div>
                                <label className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                    Tally Company Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.tallyCompanyName}
                                    onChange={e => setFormData(d => ({ ...d, tallyCompanyName: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-zinc-400"
                                    placeholder="Exact name as in TallyPrime"
                                />
                            </div>
                            <div>
                                <label className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                    Bank Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.bankName}
                                    onChange={e => setFormData(d => ({ ...d, bankName: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-zinc-400"
                                    placeholder="e.g. Bank of Baroda"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className={cn(buttonVariants({ variant: "outline", size: "default" }), "flex-1 rounded-lg font-semibold bg-white dark:bg-zinc-950 border-zinc-200 hover:bg-zinc-50")}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className={cn(buttonVariants({ size: "default" }), "flex-1 rounded-lg font-semibold shadow-sm bg-primary hover:bg-primary/90 disabled:opacity-50")}
                                >
                                    {saving ? 'Saving...' : editingClient ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
