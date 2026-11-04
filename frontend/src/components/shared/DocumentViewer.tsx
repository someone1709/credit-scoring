import { useEffect, useRef, useState } from 'react';
import { Download, Eye, Loader2, X } from 'lucide-react';
import type { Document, UserRole } from '@/types';
import { useApp } from '@/context/useApp';

// The only types the backend keeps. Anything else is downloaded rather than shown.
const IMAGE_TYPES = ['image/jpeg', 'image/png'];
const PDF_TYPE = 'application/pdf';

interface OpenFile {
    url: string;
    type: string;
}

/** Fetches with the signed-in user's token, so the file can't be opened from a shared link. */
export function ViewDocumentButton({ applicationId, document, role }: {
    applicationId: string;
    document: Document;
    role: UserRole;
}) {
    const { fetchDocumentFile } = useApp();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [file, setFile] = useState<OpenFile | null>(null);
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!file) return;
        closeRef.current?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setFile(null);
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            URL.revokeObjectURL(file.url);
        };
    }, [file]);

    const open = async () => {
        setBusy(true);
        setError(null);
        try {
            const blob = await fetchDocumentFile(applicationId, document.id, role);
            setFile({ url: URL.createObjectURL(blob), type: blob.type });
        } catch (e) {
            setError(e instanceof Error ? e.message : "This file couldn't be opened.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <button
                onClick={() => void open()}
                disabled={busy}
                aria-label={`Open ${document.label}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-60 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium transition-colors"
            >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />} Open
            </button>
            {error && <span role="alert" className="text-xs text-red-400">{error}</span>}

            {file && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={document.label}>
                    <div className="w-full max-w-4xl h-full max-h-[90vh] flex flex-col glass-card overflow-hidden">
                        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#30363d]">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{document.label}</p>
                                <p className="text-xs text-slate-500 truncate">{document.filename}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <a href={file.url} download={document.filename ?? 'document'} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d1117] hover:bg-white/5 border border-[#30363d] text-slate-300 rounded-lg text-xs font-medium transition-colors">
                                    <Download size={12} /> Download
                                </a>
                                <button ref={closeRef} onClick={() => setFile(null)} aria-label="Close" className="p-1.5 text-slate-400 hover:text-white transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 overflow-auto bg-[#0d1117] flex items-center justify-center">
                            {IMAGE_TYPES.includes(file.type) && <img src={file.url} alt={document.label} className="max-w-full max-h-full object-contain" />}
                            {file.type === PDF_TYPE && <iframe src={file.url} title={document.label} className="w-full h-full border-0" />}
                            {!IMAGE_TYPES.includes(file.type) && file.type !== PDF_TYPE && <p className="text-sm text-slate-400 p-6">This file can't be previewed. Use Download to open it.</p>}
                        </div>

                        <p className="px-4 py-2.5 border-t border-[#30363d] text-xs text-amber-400">
                            ⚠ Not verified. The system only checked this file's type and size. It doesn't prove the document is genuine.
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
