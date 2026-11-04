import clsx from 'clsx';
import type { ApplicationStatus, LenderDecisionStatus, OfferStatus, VerificationStatus, RiskCategory } from '@/types';

type BadgeVariant = ApplicationStatus | LenderDecisionStatus | OfferStatus | VerificationStatus | RiskCategory | string;

const variantMap: Record<string, string> = {
    // Application Status
    SUBMITTED: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    DOCUMENTS_REQUIRED: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    UNDER_REVIEW: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    OFFERS_AVAILABLE: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    OFFER_ACCEPTED: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    REJECTED: 'bg-red-500/15 text-red-400 border border-red-500/30',
    DISBURSED: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
    // Lender Decision
    PENDING: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
    INFO_REQUESTED: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    OFFER_MADE: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    // Offer
    ACCEPTED: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    DECLINED: 'bg-red-500/15 text-red-400 border border-red-500/30',
    EXPIRED: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
    WITHDRAWN: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
    // Verification
    DEMO_UNVERIFIED: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
    DOCUMENT_UPLOADED: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    CHECKS_PASSED: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    CHECKS_FAILED: 'bg-red-500/15 text-red-400 border border-red-500/30',
    NOT_PROVIDED: 'bg-slate-600/15 text-slate-500 border border-slate-600/30',
    // Risk
    LOW: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    MEDIUM: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    HIGH: 'bg-red-500/15 text-red-400 border border-red-500/30',
};

const labelMap: Record<string, string> = {
    DEMO_UNVERIFIED: 'Demo Unverified',
    DOCUMENT_UPLOADED: 'Uploaded',
    // The contract's value stays CHECKS_PASSED. This wording stops anyone reading it as proof.
    CHECKS_PASSED: 'File OK, Not Verified',
    CHECKS_FAILED: 'Checks Failed',
    NOT_PROVIDED: 'Not Provided',
    OFFERS_AVAILABLE: 'Offers Available',
    OFFER_ACCEPTED: 'Offer Accepted',
    OFFER_MADE: 'Offer Made',
    INFO_REQUESTED: 'Info Requested',
    UNDER_REVIEW: 'Under Review',
    DOCUMENTS_REQUIRED: 'Docs Required',
};

interface StatusBadgeProps {
    status: BadgeVariant;
    className?: string;
    size?: 'sm' | 'md';
}

export function StatusBadge({ status, className, size = 'md' }: StatusBadgeProps) {
    const cls = variantMap[status] || 'bg-slate-500/15 text-slate-400 border border-slate-500/30';
    const label = labelMap[status] || status.replace(/_/g, ' ');
    return (
        <span className={clsx(
            'inline-flex items-center rounded-full font-medium',
            size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
            cls,
            className
        )}>
            {label}
        </span>
    );
}
