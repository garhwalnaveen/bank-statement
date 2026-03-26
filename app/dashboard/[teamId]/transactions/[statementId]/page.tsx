'use client';

import { useUser } from "@stackframe/stack";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
    ArrowLeft, Save, Download, Send, Loader2, CheckCircle2,
    Search, Filter, PlusCircle, Settings2, ChevronDown, Trash2,
    BookmarkPlus, X, Plus, ChevronsUpDown
} from "lucide-react";

interface TransactionData {
    id: string;
    srNo: number;
    date: string | null;
    description: string | null;
    amount: number | null;
    debit: number | null;
    credit: number | null;
    balance: number | null;
    reference: string | null;
    transactionType: string | null;
    ledgerName: string | null;
    isAutoMatched: boolean;
    isManual: boolean;
}

interface StatementData {
    id: string;
    filename: string;
    clientId: string | null;
    clientName: string | null;
    transactionCount: number;
    metadata: { bank: string | null };
    transactions: TransactionData[];
}

interface LedgerData {
    id: string;
    name: string;
    group: string | null;
}

// ─── Add Ledger Modal ───────────────────────────────────────────────────────

function AddLedgerModal({
    initialName,
    onAdd,
    onClose,
}: {
    initialName: string;
    onAdd: (ledger: LedgerData) => void;
    onClose: () => void;
}) {
    const [name, setName] = useState(initialName);
    const [group, setGroup] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // We need the clientId & teamId from parent context — passed via the function call
    // Actually resolved via onAdd callback which calls the API
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-primary" />
                        <h2 className="font-semibold text-sm text-zinc-900 dark:text-white">Add New Ledger</h2>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    {error && (
                        <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400">
                            {error}
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                            Ledger Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => { setName(e.target.value); setError(''); }}
                            placeholder="e.g. Sales Account, Bank Charges"
                            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                            Group <span className="text-zinc-400 font-normal">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={group}
                            onChange={e => setGroup(e.target.value)}
                            placeholder="e.g. Income, Expenses, Assets"
                            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                        />
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={async () => {
                            if (!name.trim()) { setError('Ledger name is required'); return; }
                            setSaving(true);
                            setError('');
                            try {
                                await onAdd({ id: '__new__', name: name.trim(), group: group.trim() || null });
                            } catch (e: unknown) {
                                setError(e instanceof Error ? e.message : 'Failed to create ledger');
                                setSaving(false);
                            }
                        }}
                        disabled={saving || !name.trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        {saving ? 'Creating...' : 'Create Ledger'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── LedgerSelect Component ──────────────────────────────────────────────────

function LedgerSelect({
    value,
    ledgers,
    onChange,
    onRequestAddLedger,
    isAutoMatched,
}: {
    value: string;
    ledgers: LedgerData[];
    onChange: (value: string) => void;
    onRequestAddLedger: (name: string) => void;
    isAutoMatched: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const filtered = ledgers.filter(l =>
        !search || l.name.toLowerCase().includes(search.toLowerCase()) || (l.group || '').toLowerCase().includes(search.toLowerCase())
    );

    const grouped = filtered.reduce<Record<string, LedgerData[]>>((acc, l) => {
        const g = l.group || 'Other';
        if (!acc[g]) acc[g] = [];
        acc[g].push(l);
        return acc;
    }, {});

    const showAddOption = search.trim().length > 0 && !filtered.some(l => l.name.toLowerCase() === search.trim().toLowerCase());

    return (
        <div className="relative">
            <button
                onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 50); }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${value
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-400'
                    }`}
            >
                <div className="flex items-center justify-between gap-1">
                    <span className="truncate">{value || 'Select Ledger'}</span>
                    <div className="flex items-center gap-1 shrink-0">
                        {isAutoMatched && <span className="text-[9px] text-primary font-bold tracking-wider">AUTO</span>}
                        <ChevronsUpDown className="h-3 w-3 text-zinc-400" />
                    </div>
                </div>
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-20" onClick={() => { setOpen(false); setSearch(''); }} />
                    <div className="absolute top-full left-0 mt-1 w-72 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl z-30 overflow-hidden">
                        <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search or type ledger name..."
                                    className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="max-h-52 overflow-y-auto">
                            {value && (
                                <button
                                    onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
                                    className="flex items-center gap-1.5 w-full text-left px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 border-b border-zinc-50 dark:border-zinc-800"
                                >
                                    <X className="h-3 w-3" /> Clear selection
                                </button>
                            )}
                            {/* Add New Ledger Option */}
                            {showAddOption && (
                                <button
                                    onClick={() => {
                                        setOpen(false);
                                        onRequestAddLedger(search.trim());
                                        setSearch('');
                                    }}
                                    className="flex items-center gap-2 w-full text-left px-3 py-2.5 text-xs text-primary hover:bg-primary/5 dark:hover:bg-primary/10 border-b border-primary/10 font-medium"
                                >
                                    <div className="flex items-center justify-center h-4 w-4 rounded-full bg-primary/10 dark:bg-primary/20">
                                        <Plus className="h-2.5 w-2.5 text-primary" />
                                    </div>
                                    <span>Add &ldquo;<span className="font-semibold">{search.trim()}</span>&rdquo; as new ledger</span>
                                </button>
                            )}
                            {Object.entries(grouped).map(([group, items]) => (
                                <div key={group}>
                                    <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-50/50 dark:bg-zinc-800/30 sticky top-0">
                                        {group}
                                    </div>
                                    {items.map(l => (
                                        <button
                                            key={l.id}
                                            onClick={() => { onChange(l.name); setOpen(false); setSearch(''); }}
                                            className={`block w-full text-left px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors ${l.name === value ? 'bg-primary/10 dark:bg-primary/20 text-primary font-medium' : 'text-zinc-700 dark:text-zinc-300'
                                                }`}
                                        >
                                            {l.name}
                                        </button>
                                    ))}
                                </div>
                            ))}
                            {filtered.length === 0 && !showAddOption && (
                                <div className="p-4 text-center text-xs text-zinc-400">
                                    No ledgers found.{' '}
                                    {search && (
                                        <button
                                            onClick={() => { setOpen(false); onRequestAddLedger(search.trim()); setSearch(''); }}
                                            className="text-primary hover:underline font-medium"
                                        >
                                            Create &ldquo;{search}&rdquo;
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        {ledgers.length === 0 && !search && (
                            <div className="p-3 border-t border-zinc-100 dark:border-zinc-800">
                                <button
                                    onClick={() => { setOpen(false); onRequestAddLedger(''); }}
                                    className="flex items-center gap-1.5 w-full justify-center text-xs text-primary hover:underline font-medium"
                                >
                                    <Plus className="h-3 w-3" /> Add your first ledger
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TransactionReviewPage() {
    const params = useParams<{ teamId: string; statementId: string }>();
    const user = useUser({ or: 'redirect' });
    const team = user.useTeam(params.teamId);
    const router = useRouter();

    const [statement, setStatement] = useState<StatementData | null>(null);
    const [loading, setLoading] = useState(true);
    const [ledgers, setLedgers] = useState<LedgerData[]>([]);
    const [assignments, setAssignments] = useState<Record<string, { ledgerName: string; transactionType: string }>>({});
    const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'assigned' | 'pending'>('all');
    const [amountFrom, setAmountFrom] = useState('');
    const [amountTo, setAmountTo] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Bulk dropdowns
    const [showBulkType, setShowBulkType] = useState(false);
    const [showBulkLedger, setShowBulkLedger] = useState(false);
    const [ledgerSearch, setLedgerSearch] = useState('');

    // Add Ledger modal
    const [addLedgerModal, setAddLedgerModal] = useState<{ open: boolean; initialName: string; forTxnId: string | null }>({
        open: false, initialName: '', forTxnId: null
    });

    const fetchLedgers = useCallback(async (clientId: string) => {
        if (!team) return;
        try {
            const res = await fetch(`/api/clients/${clientId}?teamId=${team.id}`);
            const data = await res.json();
            setLedgers(data.ledgers || []);
        } catch { /* ignore */ }
    }, [team]);

    useEffect(() => {
        if (!team) return;
        fetch(`/api/statements/${params.statementId}?teamId=${team.id}`)
            .then(res => res.json())
            .then(data => {
                setStatement(data);
                const initial: Record<string, { ledgerName: string; transactionType: string }> = {};
                for (const t of data.transactions || []) {
                    if (t.ledgerName || t.transactionType) {
                        initial[t.id] = {
                            ledgerName: t.ledgerName || '',
                            transactionType: t.transactionType || '',
                        };
                    }
                }
                setAssignments(initial);
                setLoading(false);
                if (data.clientId) fetchLedgers(data.clientId);
            })
            .catch(() => setLoading(false));
    }, [team, params.statementId, fetchLedgers]);

    const getAutoType = useCallback((t: TransactionData) => {
        if (t.credit && t.credit > 0) return 'Receipt';
        if (t.debit && t.debit > 0) return 'Payment';
        if (t.amount != null) return t.amount >= 0 ? 'Receipt' : 'Payment';
        return '';
    }, []);

    const setAssignment = (txnId: string, field: 'ledgerName' | 'transactionType', value: string) => {
        setAssignments(prev => ({
            ...prev,
            [txnId]: {
                ...prev[txnId],
                ledgerName: prev[txnId]?.ledgerName || '',
                transactionType: prev[txnId]?.transactionType || '',
                [field]: value,
            },
        }));
        setSaved(false);
    };

    // ── Selections ──────────────────────────────────────────────────────────

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredTransactions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
        }
    };

    // ── Delete row ──────────────────────────────────────────────────────────

    const deleteRow = (id: string) => {
        setDeletedIds(prev => new Set([...prev, id]));
        setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        setSaved(false);
    };

    const deleteSelected = () => {
        setDeletedIds(prev => new Set([...prev, ...selectedIds]));
        setSelectedIds(new Set());
        setSaved(false);
    };

    // ── Bulk ops ────────────────────────────────────────────────────────────

    const bulkSetType = (type: string) => {
        const targets = selectedIds.size > 0 ? filteredTransactions.filter(t => selectedIds.has(t.id)) : filteredTransactions;
        const updated = { ...assignments };
        for (const t of targets) {
            updated[t.id] = { ...updated[t.id], ledgerName: updated[t.id]?.ledgerName || '', transactionType: type };
        }
        setAssignments(updated);
        setShowBulkType(false);
        setSaved(false);
    };

    const bulkSetLedger = (ledgerName: string) => {
        const targets = selectedIds.size > 0 ? filteredTransactions.filter(t => selectedIds.has(t.id)) : filteredTransactions;
        const updated = { ...assignments };
        for (const t of targets) {
            updated[t.id] = { ...updated[t.id], transactionType: updated[t.id]?.transactionType || getAutoType(t), ledgerName };
        }
        setAssignments(updated);
        setShowBulkLedger(false);
        setSaved(false);
    };

    // ── Save ────────────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!team || !statement) return;
        setSaving(true);
        try {
            const assignmentsList = Object.entries(assignments)
                .filter(([, v]) => v.ledgerName || v.transactionType)
                .map(([transactionId, v]) => ({
                    transactionId,
                    ledgerName: v.ledgerName,
                    transactionType: v.transactionType,
                }));

            await fetch(`/api/statements/${statement.id}/assign-ledgers`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamId: team.id, assignments: assignmentsList }),
            });
            setSaved(true);
        } catch { /* ignore */ } finally {
            setSaving(false);
        }
    };

    // ── Export ──────────────────────────────────────────────────────────────

    const handleExport = async (action: 'download' | 'send') => {
        if (!team || !statement) return;
        setExporting(true);
        try {
            const res = await fetch(`/api/statements/${statement.id}/export-tally`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamId: team.id, action }),
            });

            if (action === 'download') {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${statement.filename.replace(/\.pdf$/i, '')}_tally.xml`;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                const data = await res.json();
                if (data.success) {
                    alert(`Successfully sent ${data.voucherCount} vouchers to Tally!`);
                } else {
                    alert(data.error || 'Failed to send to Tally');
                }
            }
        } catch { /* ignore */ } finally {
            setExporting(false);
        }
    };

    // ── Save as Rule ────────────────────────────────────────────────────────

    const handleSaveAsRule = async (txn: TransactionData) => {
        if (!team || !statement?.clientId) {
            alert('Statement must be linked to a client to save rules');
            return;
        }
        const assignment = assignments[txn.id];
        if (!assignment?.ledgerName || !assignment?.transactionType) {
            alert('Please assign both a ledger and transaction type before saving as a rule');
            return;
        }
        const pattern = prompt('Enter the narration pattern for this rule:', txn.description || '');
        if (!pattern) return;

        try {
            await fetch(`/api/clients/${statement.clientId}/rules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teamId: team.id,
                    pattern,
                    matchType: 'contains',
                    ledgerName: assignment.ledgerName,
                    transactionType: assignment.transactionType,
                }),
            });
            alert('Rule saved! Future transactions matching this pattern will be auto-assigned.');
        } catch { /* ignore */ }
    };

    // ── Add Ledger handler ──────────────────────────────────────────────────

    const handleAddLedger = async (draft: LedgerData) => {
        if (!team || !statement?.clientId) throw new Error('No client linked');

        const res = await fetch(`/api/clients/${statement.clientId}/ledgers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teamId: team.id, name: draft.name, group: draft.group }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create ledger');

        // Add to local list and auto-assign to the triggering row
        setLedgers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
        if (addLedgerModal.forTxnId) {
            setAssignment(addLedgerModal.forTxnId, 'ledgerName', data.name);
        }
        setAddLedgerModal({ open: false, initialName: '', forTxnId: null });
    };

    // ── Filters ─────────────────────────────────────────────────────────────

    const filteredTransactions = useMemo(() => {
        if (!statement) return [];
        return statement.transactions.filter(t => {
            if (deletedIds.has(t.id)) return false;

            const q = searchQuery.toLowerCase();
            const matchesSearch = !q ||
                (t.description || '').toLowerCase().includes(q) ||
                (t.date || '').includes(q) ||
                (t.reference || '').toLowerCase().includes(q);

            const amt = Math.abs(t.amount || 0);
            const from = amountFrom ? parseFloat(amountFrom) : null;
            const to = amountTo ? parseFloat(amountTo) : null;
            const matchesAmount = (from === null || amt >= from) && (to === null || amt <= to);

            const assignment = assignments[t.id];
            const isAssigned = !!(assignment?.ledgerName);
            const matchesFilter = filterType === 'all' ||
                (filterType === 'assigned' && isAssigned) ||
                (filterType === 'pending' && !isAssigned);

            return matchesSearch && matchesFilter && matchesAmount;
        });
    }, [statement, searchQuery, filterType, assignments, deletedIds, amountFrom, amountTo]);

    const assignedCount = useMemo(() =>
        Object.entries(assignments).filter(([id, a]) => a.ledgerName && !deletedIds.has(id)).length
        , [assignments, deletedIds]);

    const visibleCount = statement ? statement.transactions.length - deletedIds.size : 0;
    const allSelected = filteredTransactions.length > 0 && selectedIds.size === filteredTransactions.length;
    const someSelected = selectedIds.size > 0 && !allSelected;

    const activeFiltersCount = [searchQuery, amountFrom, amountTo].filter(Boolean).length;

    if (!team) return null;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!statement) {
        return (
            <div className="p-8 text-center">
                <p className="text-zinc-500">Statement not found</p>
            </div>
        );
    }

    return (
        <>
            {/* Add Ledger Modal */}
            {addLedgerModal.open && (
                <AddLedgerModal
                    initialName={addLedgerModal.initialName}
                    onAdd={handleAddLedger}
                    onClose={() => setAddLedgerModal({ open: false, initialName: '', forTxnId: null })}
                />
            )}

            <div className="flex flex-col h-[calc(100vh-56px)]">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
                            <ArrowLeft className="h-4 w-4 text-zinc-500" />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="font-semibold text-zinc-900 dark:text-white text-sm">{statement.filename}</h1>
                                {statement.clientName && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                                        {statement.clientName}
                                    </span>
                                )}
                                {statement.metadata.bank && (
                                    <span className="text-xs text-zinc-400">Bank: {statement.metadata.bank}</span>
                                )}
                            </div>
                            <p className="text-xs text-zinc-500 mt-0.5">
                                {assignedCount}/{visibleCount} assigned · {visibleCount - assignedCount} pending
                                {deletedIds.size > 0 && <span className="text-zinc-400"> · {deletedIds.size} removed</span>}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!statement.clientId && (
                            <button
                                onClick={() => setAddLedgerModal({ open: true, initialName: '', forTxnId: null })}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <Plus className="h-3.5 w-3.5" /> Add Ledger
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                            {saved ? 'Saved' : 'Save'}
                        </button>
                        <button
                            onClick={() => handleExport('download')}
                            disabled={exporting || assignedCount === 0}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                        >
                            <Download className="h-3.5 w-3.5" /> Export XML
                        </button>
                        <button
                            onClick={() => handleExport('send')}
                            disabled={exporting || assignedCount === 0}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 shadow-sm text-white text-xs font-medium transition-colors disabled:opacity-50"
                        >
                            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            Send to Tally
                        </button>
                    </div>
                </div>

                {/* ── Filters Bar ── */}
                <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 shrink-0 flex-wrap">
                    {/* Search */}
                    <div className="relative min-w-[200px] flex-1 max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search narration..."
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>

                    {/* Status Tabs */}
                    <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
                        {(['all', 'assigned', 'pending'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilterType(f)}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filterType === f
                                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                                    }`}
                            >
                                {f === 'all' ? `All (${visibleCount})` : f === 'assigned' ? `Assigned (${assignedCount})` : `Pending (${visibleCount - assignedCount})`}
                            </button>
                        ))}
                    </div>

                    {/* Advanced Filters Toggle */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${showFilters || activeFiltersCount > 0
                            ? 'border-primary/40 bg-primary/5 dark:bg-primary/10 text-primary'
                            : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                            }`}
                    >
                        <Filter className="h-3 w-3" />
                        Filters
                        {activeFiltersCount > 0 && (
                            <span className="bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                                {activeFiltersCount}
                            </span>
                        )}
                    </button>

                    {/* Bulk Actions (right side) */}
                    <div className="flex gap-1 ml-auto items-center">
                        {selectedIds.size > 0 && (
                            <span className="text-xs text-zinc-500 mr-1">
                                {selectedIds.size} selected
                            </span>
                        )}

                        {/* Bulk Type */}
                        <div className="relative">
                            <button
                                onClick={() => setShowBulkType(!showBulkType)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                            >
                                <Settings2 className="h-3 w-3" />
                                {selectedIds.size > 0 ? `Bulk Type (${selectedIds.size})` : 'Bulk Type'}
                                <ChevronDown className="h-3 w-3" />
                            </button>
                            {showBulkType && (
                                <>
                                    <div className="fixed inset-0 z-20" onClick={() => setShowBulkType(false)} />
                                    <div className="absolute top-full right-0 mt-1 w-36 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg z-30 overflow-hidden">
                                        {['Receipt', 'Payment', 'Contra', 'Journal'].map(t => (
                                            <button key={t} onClick={() => bulkSetType(t)} className="block w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Bulk Ledger */}
                        <div className="relative">
                            <button
                                onClick={() => setShowBulkLedger(!showBulkLedger)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                            >
                                <Filter className="h-3 w-3" />
                                {selectedIds.size > 0 ? `Bulk Ledger (${selectedIds.size})` : 'Bulk Ledger'}
                                <ChevronDown className="h-3 w-3" />
                            </button>
                            {showBulkLedger && (
                                <>
                                    <div className="fixed inset-0 z-20" onClick={() => setShowBulkLedger(false)} />
                                    <div className="absolute top-full right-0 mt-1 w-64 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg z-30 overflow-hidden">
                                        <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
                                            <input
                                                type="text"
                                                value={ledgerSearch}
                                                onChange={e => setLedgerSearch(e.target.value)}
                                                placeholder="Search ledger..."
                                                className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="max-h-48 overflow-y-auto">
                                            {ledgers
                                                .filter(l => !ledgerSearch || l.name.toLowerCase().includes(ledgerSearch.toLowerCase()))
                                                .map(l => (
                                                    <button
                                                        key={l.id}
                                                        onClick={() => { bulkSetLedger(l.name); setLedgerSearch(''); }}
                                                        className="block w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                                    >
                                                        <span className="font-medium">{l.name}</span>
                                                        {l.group && <span className="text-zinc-400 ml-1">({l.group})</span>}
                                                    </button>
                                                ))}
                                            {ledgers.length === 0 && (
                                                <div className="p-3 text-center text-xs text-zinc-400">No ledgers. Add one first.</div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Delete selected */}
                        {selectedIds.size > 0 && (
                            <button
                                onClick={deleteSelected}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            >
                                <Trash2 className="h-3 w-3" />
                                Delete ({selectedIds.size})
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Advanced Filters Panel ── */}
                {showFilters && (
                    <div className="flex items-center gap-4 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs shrink-0">
                        <span className="font-medium text-zinc-500">Amount Range:</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={amountFrom}
                                onChange={e => setAmountFrom(e.target.value)}
                                placeholder="From"
                                className="w-28 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <span className="text-zinc-400">—</span>
                            <input
                                type="number"
                                value={amountTo}
                                onChange={e => setAmountTo(e.target.value)}
                                placeholder="To"
                                className="w-28 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                        {(amountFrom || amountTo) && (
                            <button
                                onClick={() => { setAmountFrom(''); setAmountTo(''); }}
                                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-1"
                            >
                                <X className="h-3 w-3" /> Clear
                            </button>
                        )}
                    </div>
                )}

                {/* ── Table ── */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-zinc-50 dark:bg-zinc-800/50 sticky top-0 z-10">
                            <tr>
                                {/* Select All Checkbox */}
                                <th className="px-3 py-2.5 w-8">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        ref={el => { if (el) el.indeterminate = someSelected; }}
                                        onChange={toggleSelectAll}
                                        className="rounded border-zinc-300 dark:border-zinc-600 text-primary focus:ring-primary/30 cursor-pointer"
                                    />
                                </th>
                                <th className="text-left px-2 py-2.5 font-semibold text-zinc-500 uppercase tracking-wider w-10">Sr.</th>
                                <th className="text-left px-3 py-2.5 font-semibold text-zinc-500 uppercase tracking-wider w-24">Date</th>
                                <th className="text-left px-3 py-2.5 font-semibold text-zinc-500 uppercase tracking-wider min-w-[200px]">Description</th>
                                <th className="text-center px-3 py-2.5 font-semibold text-zinc-500 uppercase tracking-wider w-32">Type</th>
                                <th className="text-right px-3 py-2.5 font-semibold text-zinc-500 uppercase tracking-wider w-28">Amount</th>
                                <th className="text-left px-3 py-2.5 font-semibold text-zinc-500 uppercase tracking-wider min-w-[220px]">Ledger</th>
                                <th className="text-center px-3 py-2.5 font-semibold text-zinc-500 uppercase tracking-wider w-20">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center text-zinc-400 text-sm">
                                        No transactions match your filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredTransactions.map((t, i) => {
                                    const assignment = assignments[t.id];
                                    const currentType = assignment?.transactionType || t.transactionType || getAutoType(t);
                                    const currentLedger = assignment?.ledgerName || t.ledgerName || '';
                                    const isAssigned = !!currentLedger;
                                    const isSelected = selectedIds.has(t.id);

                                    return (
                                        <tr
                                            key={t.id}
                                            className={`border-b border-zinc-50 dark:border-zinc-800/50 transition-colors ${isSelected
                                                ? 'bg-primary/5 dark:bg-primary/10'
                                                : isAssigned
                                                    ? 'bg-blue-50/20 dark:bg-blue-500/5'
                                                    : i % 2 === 0
                                                        ? 'bg-white dark:bg-zinc-900'
                                                        : 'bg-zinc-50/30 dark:bg-zinc-800/20'
                                                } hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40`}
                                        >
                                            {/* Checkbox */}
                                            <td className="px-3 py-2">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelect(t.id)}
                                                    className="rounded border-zinc-300 dark:border-zinc-600 text-primary focus:ring-primary/30 cursor-pointer"
                                                />
                                            </td>

                                            {/* Sr. No */}
                                            <td className="px-2 py-2 text-zinc-400 font-mono">{t.srNo}</td>

                                            {/* Date */}
                                            <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 whitespace-nowrap font-mono text-[11px]">
                                                {t.date || '—'}
                                            </td>

                                            {/* Description */}
                                            <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                                                <div className="max-w-[280px]">
                                                    <p className="truncate" title={t.description || ''}>{t.description || '—'}</p>
                                                    {t.reference && <p className="text-zinc-400 text-[10px] truncate">Ref: {t.reference}</p>}
                                                </div>
                                            </td>

                                            {/* Type */}
                                            <td className="px-3 py-2">
                                                <select
                                                    value={currentType}
                                                    onChange={e => setAssignment(t.id, 'transactionType', e.target.value)}
                                                    className={`w-full px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${currentType === 'Receipt'
                                                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                                        : currentType === 'Payment'
                                                            ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                                                            : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                                                        }`}
                                                >
                                                    <option value="">Select Type</option>
                                                    <option value="Receipt">Receipt</option>
                                                    <option value="Payment">Payment</option>
                                                    <option value="Contra">Contra</option>
                                                    <option value="Journal">Journal</option>
                                                </select>
                                            </td>

                                            {/* Amount */}
                                            <td className={`px-3 py-2 text-right font-mono whitespace-nowrap font-medium ${(t.credit && t.credit > 0) || (t.amount && t.amount > 0)
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-red-600 dark:text-red-400'
                                                }`}>
                                                {t.amount != null
                                                    ? Math.abs(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                                    : '—'}
                                            </td>

                                            {/* Ledger */}
                                            <td className="px-3 py-2">
                                                <LedgerSelect
                                                    value={currentLedger}
                                                    ledgers={ledgers}
                                                    onChange={value => setAssignment(t.id, 'ledgerName', value)}
                                                    onRequestAddLedger={(name) => setAddLedgerModal({ open: true, initialName: name, forTxnId: t.id })}
                                                    isAutoMatched={t.isAutoMatched}
                                                />
                                            </td>

                                            {/* Actions */}
                                            <td className="px-3 py-2">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => handleSaveAsRule(t)}
                                                        className="p-1.5 rounded-lg hover:bg-primary/10 dark:hover:bg-primary/20 text-zinc-400 hover:text-primary transition-colors"
                                                        title="Save as Rule"
                                                    >
                                                        <BookmarkPlus className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteRow(t.id)}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                                        title="Remove row"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── Status Bar ── */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-500 shrink-0">
                    <span>
                        Showing {filteredTransactions.length} of {visibleCount} transactions
                        {deletedIds.size > 0 && <span className="ml-2 text-zinc-400">({deletedIds.size} removed)</span>}
                    </span>
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            {assignedCount} assigned
                        </span>
                        <span className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-amber-400" />
                            {visibleCount - assignedCount} pending
                        </span>
                        {statement.clientId && ledgers.length === 0 && (
                            <button
                                onClick={() => setAddLedgerModal({ open: true, initialName: '', forTxnId: null })}
                                className="flex items-center gap-1 text-primary hover:underline font-medium"
                            >
                                <PlusCircle className="h-3.5 w-3.5" /> Add ledgers
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
