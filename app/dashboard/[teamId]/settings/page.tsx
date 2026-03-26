'use client';

import { useUser } from "@stackframe/stack";
import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
    Settings2, Loader2, CheckCircle2, Wifi, WifiOff, Building2,
    Key, Copy, Trash2, Plus, Eye, EyeOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface TallyTokenRecord {
    id: string;
    name: string;
    tokenPrefix: string;
    lastUsedAt: string | null;
    createdAt: string;
}

export default function SettingsPage() {
    const params = useParams<{ teamId: string }>();
    const user = useUser({ or: 'redirect' });
    const team = user.useTeam(params.teamId);

    // --- Tally Connection state ---
    const [host, setHost] = useState('localhost');
    const [port, setPort] = useState(9000);
    const [companyName, setCompanyName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [testing, setTesting] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<{ connected: boolean; companies?: string[]; error?: string } | null>(null);

    // --- Token management state ---
    const [tokens, setTokens] = useState<TallyTokenRecord[]>([]);
    const [tokensLoading, setTokensLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [newTokenName, setNewTokenName] = useState('');
    const [revealedToken, setRevealedToken] = useState<string | null>(null);
    const [showToken, setShowToken] = useState(false);
    const [copied, setCopied] = useState(false);
    const [revoking, setRevoking] = useState<string | null>(null);

    const fetchSettings = useCallback(async () => {
        if (!team) return;
        try {
            const res = await fetch(`/api/tally/settings?teamId=${team.id}`);
            const data = await res.json();
            setHost(data.host || 'localhost');
            setPort(data.port || 9000);
            setCompanyName(data.companyName || '');
        } catch { /* ignore */ } finally {
            setLoading(false);
        }
    }, [team]);

    const fetchTokens = useCallback(async () => {
        if (!team) return;
        try {
            const res = await fetch(`/api/tally/tokens?teamId=${team.id}`);
            const data = await res.json();
            setTokens(data.tokens || []);
        } catch { /* ignore */ } finally {
            setTokensLoading(false);
        }
    }, [team]);

    useEffect(() => {
        fetchSettings();
        fetchTokens();
    }, [fetchSettings, fetchTokens]);

    const handleSave = async () => {
        if (!team) return;
        setSaving(true);
        try {
            await fetch('/api/tally/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamId: team.id, host, port, companyName }),
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch { /* ignore */ } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setTesting(true);
        setConnectionStatus(null);
        try {
            const res = await fetch('/api/tally/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ host, port }),
            });
            const data = await res.json();
            setConnectionStatus(data);
        } catch {
            setConnectionStatus({ connected: false, error: 'Failed to test connection' });
        } finally {
            setTesting(false);
        }
    };

    const handleGenerateToken = async () => {
        if (!team) return;
        setGenerating(true);
        try {
            const res = await fetch('/api/tally/tokens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamId: team.id, name: newTokenName || 'Sync Token' }),
            });
            const data = await res.json();
            setRevealedToken(data.token);
            setShowToken(true);
            setNewTokenName('');
            await fetchTokens();
        } catch { /* ignore */ } finally {
            setGenerating(false);
        }
    };

    const handleCopyToken = () => {
        if (!revealedToken) return;
        navigator.clipboard.writeText(revealedToken);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRevokeToken = async (id: string) => {
        setRevoking(id);
        try {
            await fetch(`/api/tally/tokens?id=${id}`, { method: 'DELETE' });
            setTokens(t => t.filter(tok => tok.id !== id));
        } catch { /* ignore */ } finally {
            setRevoking(null);
        }
    };

    if (!team) return null;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-[22px] font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Settings</h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Configure your Tally connection and desktop sync agent</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="space-y-6">

                    {/* ── TallyPrime Connection Card ─────────────────────────────── */}
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm space-y-6">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 shrink-0">
                                <Settings2 className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-zinc-900 dark:text-white text-[15px]">TallyPrime Connection</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">Make sure TallyPrime is running with the XML Server enabled</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                            <div>
                                <label className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Host</label>
                                <input
                                    type="text"
                                    value={host}
                                    onChange={e => setHost(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Port</label>
                                <input
                                    type="number"
                                    value={port}
                                    onChange={e => setPort(parseInt(e.target.value) || 9000)}
                                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Default Company Name</label>
                            <input
                                type="text"
                                value={companyName}
                                onChange={e => setCompanyName(e.target.value)}
                                placeholder="As shown exactly in TallyPrime"
                                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-zinc-400"
                            />
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-6">
                            <button
                                onClick={handleTestConnection}
                                disabled={testing}
                                className={cn(buttonVariants({ variant: "outline", size: "default" }), "rounded-lg font-semibold bg-white dark:bg-zinc-950 border-zinc-200 hover:bg-zinc-50 disabled:opacity-50")}
                            >
                                {testing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wifi className="h-4 w-4 mr-1.5" />}
                                Test Connection
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className={cn(buttonVariants({ size: "default" }), "rounded-lg font-semibold shadow-sm bg-primary hover:bg-primary/90 disabled:opacity-50")}
                            >
                                {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4 mr-1.5" /> : null}
                                {saved ? 'Saved!' : 'Save Settings'}
                            </button>
                        </div>

                        {connectionStatus && (
                            <div className={`p-4 rounded-lg border ${connectionStatus.connected
                                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-500/5'
                                : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-500/5'
                                }`}>
                                <div className="flex items-center gap-2 mb-1.5">
                                    {connectionStatus.connected ? (
                                        <><Wifi className="h-4 w-4 text-emerald-600" /><span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Connected to Tally</span></>
                                    ) : (
                                        <><WifiOff className="h-4 w-4 text-red-600" /><span className="text-sm font-semibold text-red-700 dark:text-red-400">Connection Failed</span></>
                                    )}
                                </div>
                                {connectionStatus.error && <p className="text-[13px] text-red-600 dark:text-red-400">{connectionStatus.error}</p>}
                                {connectionStatus.companies && connectionStatus.companies.length > 0 && (
                                    <div className="mt-3 bg-white/50 dark:bg-black/20 rounded-md p-3 border border-emerald-100 dark:border-emerald-900/50">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-500 mb-2">Available Companies</p>
                                        <div className="space-y-1">
                                            {connectionStatus.companies.map((c, i) => (
                                                <div key={i} className="flex items-center gap-2 text-[13px] font-medium text-emerald-800 dark:text-emerald-300">
                                                    <Building2 className="h-3.5 w-3.5 opacity-70" />{c}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Desktop Sync Agent / Token Management Card ─────────────── */}
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm space-y-5">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 shrink-0">
                                <Key className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-zinc-900 dark:text-white text-[15px]">Desktop Sync Agent</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                    Generate a sync token and paste it into the Tally Sync desktop app to securely link your team
                                </p>
                            </div>
                        </div>

                        {/* New token revealed — shown once after generation */}
                        {revealedToken && (
                            <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-500/5">
                                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">
                                    ✓ Token Generated — Copy it now, it won&apos;t be shown again
                                </p>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 font-mono text-sm bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 truncate">
                                        {showToken ? revealedToken : revealedToken.replace(/./g, '•')}
                                    </code>
                                    <button
                                        onClick={() => setShowToken(v => !v)}
                                        className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                                        title={showToken ? "Hide token" : "Show token"}
                                    >
                                        {showToken ? <EyeOff className="h-4 w-4 text-zinc-500" /> : <Eye className="h-4 w-4 text-zinc-500" />}
                                    </button>
                                    <button
                                        onClick={handleCopyToken}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors",
                                            copied
                                                ? "bg-emerald-600 text-white"
                                                : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                        )}
                                    >
                                        {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                        {copied ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                                <button
                                    onClick={() => setRevealedToken(null)}
                                    className="mt-3 text-xs text-zinc-400 hover:text-zinc-600 transition-colors underline-offset-2 hover:underline"
                                >
                                    Dismiss
                                </button>
                            </div>
                        )}

                        {/* Generate new token form */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newTokenName}
                                onChange={e => setNewTokenName(e.target.value)}
                                placeholder="Token name (e.g. Office PC)"
                                className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all placeholder:text-zinc-400"
                                onKeyDown={e => { if (e.key === 'Enter') handleGenerateToken(); }}
                            />
                            <button
                                onClick={handleGenerateToken}
                                disabled={generating}
                                className={cn(
                                    buttonVariants({ size: "default" }),
                                    "rounded-lg font-semibold shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 shrink-0"
                                )}
                            >
                                {generating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
                                Generate Token
                            </button>
                        </div>

                        {/* Existing tokens list */}
                        {tokensLoading ? (
                            <div className="flex items-center gap-2 text-zinc-400 text-sm py-3">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading tokens…
                            </div>
                        ) : tokens.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 py-8 text-center">
                                <Key className="h-7 w-7 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                                <p className="text-sm text-zinc-500">No sync tokens yet. Generate one to connect your desktop agent.</p>
                            </div>
                        ) : (
                            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
                                {tokens.map(tok => (
                                    <div key={tok.id} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 shrink-0">
                                                <Key className="h-3.5 w-3.5 text-zinc-500" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{tok.name}</p>
                                                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                                                    {tok.tokenPrefix}••••••••
                                                    <span className="font-sans ml-2 not-italic">
                                                        · Created {new Date(tok.createdAt).toLocaleDateString()}
                                                        {tok.lastUsedAt && ` · Last used ${new Date(tok.lastUsedAt).toLocaleDateString()}`}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRevokeToken(tok.id)}
                                            disabled={revoking === tok.id}
                                            className="ml-4 p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0 disabled:opacity-40"
                                            title="Revoke token"
                                        >
                                            {revoking === tok.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="pt-2 px-1">
                            <p className="text-[12px] text-zinc-400 leading-relaxed">
                                <strong className="text-zinc-500">How it works:</strong> Download the Tally Sync desktop app on your Windows PC running Tally.
                                Enter your server URL and paste this token — no login needed. The app will automatically sync your Tally companies and ledgers every 15 minutes.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
