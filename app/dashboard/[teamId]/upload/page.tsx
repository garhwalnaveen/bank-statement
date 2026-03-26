'use client';

import { useUser } from "@stackframe/stack";
import { useParams, useRouter } from "next/navigation";
import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, X, ArrowRight, Building2, CloudUpload } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface ClientOption {
    id: string;
    name: string;
    bankName: string | null;
}

interface UploadResult {
    id: string;
    filename: string;
    transactionCount: number;
    metadata: {
        bank: string | null;
        account_number: string | null;
        currency: string | null;
    };
    validation: {
        is_valid: boolean;
    } | null;
    warnings: string[];
}

export default function UploadPage() {
    const params = useParams<{ teamId: string }>();
    const user = useUser({ or: 'redirect' });
    const team = user.useTeam(params.teamId);
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [status, setStatus] = useState<UploadStatus>('idle');
    const [dragOver, setDragOver] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedClient, setSelectedClient] = useState('');
    const [clients, setClients] = useState<ClientOption[]>([]);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<UploadResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!team) return;
        fetch(`/api/clients?teamId=${team.id}`)
            .then(res => res.json())
            .then(data => setClients(data.clients || []))
            .catch(() => { });
    }, [team]);

    const handleFile = useCallback((file: File) => {
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            setError('Only PDF files are accepted');
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            setError('File size must be under 50MB');
            return;
        }
        setSelectedFile(file);
        setError(null);
        setResult(null);
        setStatus('idle');
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleUpload = async () => {
        if (!selectedFile || !team) return;

        setStatus('uploading');
        setProgress(0);
        setError(null);

        const progressInterval = setInterval(() => {
            setProgress(prev => prev >= 90 ? prev : prev + Math.random() * 15);
        }, 500);

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('teamId', team.id);
            if (selectedClient) formData.append('clientId', selectedClient);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            clearInterval(progressInterval);
            setProgress(100);

            if (!response.ok) {
                const data = await response.json().catch(() => ({ error: 'Upload failed' }));
                throw new Error(data.error || 'Upload failed');
            }

            const data = await response.json();
            setResult(data);
            setStatus('success');
        } catch (err) {
            clearInterval(progressInterval);
            setError(err instanceof Error ? err.message : 'Upload failed');
            setStatus('error');
        }
    };

    const resetUpload = () => {
        setSelectedFile(null);
        setResult(null);
        setError(null);
        setStatus('idle');
        setProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    if (!team) return null;

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-[22px] font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    Upload Bank Statement
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    Upload a PDF bank statement to parse transactions and assign to ledgers
                </p>
            </div>

            {/* Client Selector */}
            {clients.length > 0 && status !== 'success' && (
                <div className="rounded-xl border border-zinc-200 bg-white dark:bg-zinc-950 dark:border-zinc-800 p-5 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-500/10">
                            <Building2 className="h-5 w-5 text-blue-500" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                Select Client Company
                            </label>
                            <select
                                value={selectedClient}
                                onChange={e => setSelectedClient(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            >
                                <option value="">No client (standalone upload)</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}{c.bankName ? ` — ${c.bankName}` : ''}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Zone */}
            {status !== 'success' && (
                <div
                    onDrop={handleDrop}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
                    onClick={() => !selectedFile && fileInputRef.current?.click()}
                    className={`relative rounded-xl border-2 border-dashed p-10 text-center transition-all duration-200 cursor-pointer ${dragOver
                            ? 'border-primary bg-primary/5 scale-[1.01]'
                            : selectedFile
                                ? 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50'
                                : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-primary/40 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                        }`}
                >
                    <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
                        onChange={e => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />

                    {!selectedFile ? (
                        <div className="space-y-4">
                            <div className="mx-auto w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                                <CloudUpload className="h-6 w-6 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-white">Click to upload or drag and drop</p>
                                <p className="text-xs text-zinc-500 mt-1">PDF bank statements (max 50MB)</p>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-md mx-auto relative z-10">
                            <div className="flex items-center gap-4 p-4 rounded-xl border border-zinc-200 bg-white dark:bg-zinc-950 dark:border-zinc-800 shadow-sm text-left">
                                <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 shrink-0">
                                    <FileText className="h-6 w-6 text-blue-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{selectedFile.name}</p>
                                    <p className="text-xs text-zinc-500 mt-0.5">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                                <button onClick={e => { e.stopPropagation(); resetUpload(); }} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            {status === 'uploading' && (
                                <div className="mt-4 px-1 space-y-2">
                                    <div className="flex items-center justify-between text-xs font-medium">
                                        <span className="text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                            Parsing & applying rules...
                                        </span>
                                        <span className="text-zinc-900 dark:text-white">{Math.round(progress)}%</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                        <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {error && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/20">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-red-800 dark:text-red-400">Upload Failed</p>
                        <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">{error}</p>
                    </div>
                </div>
            )}

            {selectedFile && status !== 'success' && status !== 'uploading' && (
                <button onClick={handleUpload}
                    className={cn(buttonVariants({ size: "default" }), "w-full font-semibold rounded-lg shadow-sm bg-primary hover:bg-primary/90")}>
                    Parse & Upload Statement
                </button>
            )}

            {status === 'success' && result && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="p-6 rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/5 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-emerald-800 dark:text-emerald-400">Successfully Parsed!</h3>
                                <p className="text-sm text-emerald-600 dark:text-emerald-500">{result.filename}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-white/50 dark:bg-zinc-900/50 rounded-lg p-3 border border-emerald-100 dark:border-emerald-500/10 shadow-sm">
                                <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70 uppercase font-semibold tracking-wider">Transactions</p>
                                <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-1">{result.transactionCount}</p>
                            </div>
                            <div className="bg-white/50 dark:bg-zinc-900/50 rounded-lg p-3 border border-emerald-100 dark:border-emerald-500/10 shadow-sm">
                                <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70 uppercase font-semibold tracking-wider">Bank</p>
                                <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-1">{result.metadata?.bank || 'Unknown'}</p>
                            </div>
                            <div className="bg-white/50 dark:bg-zinc-900/50 rounded-lg p-3 border border-emerald-100 dark:border-emerald-500/10 shadow-sm">
                                <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70 uppercase font-semibold tracking-wider">Status</p>
                                <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-1">
                                    {result.validation?.is_valid ? '✅ Valid' : '⚠️ Review'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => router.push(`/dashboard/${team.id}/transactions/${result.id}`)}
                            className={cn(buttonVariants({ size: "default" }), "flex-1 flex items-center justify-center gap-2 rounded-lg font-semibold shadow-sm bg-primary hover:bg-primary/90")}
                        >
                            Review & Assign Ledgers <ArrowRight className="h-4 w-4" />
                        </button>
                        <button onClick={resetUpload}
                            className={cn(buttonVariants({ variant: "outline", size: "default" }), "flex items-center justify-center gap-2 rounded-lg font-semibold bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50")}>
                            Upload Another
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
