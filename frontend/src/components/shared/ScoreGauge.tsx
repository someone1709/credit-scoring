interface ScoreGaugeProps {
    score: number;         // 0–100
    label: string;
    sublabel?: string;
    // The two scores read in opposite directions: high risk is bad, high composite is good.
    kind: 'risk' | 'composite';
    size?: number;
}

function gaugeColor(score: number, kind: ScoreGaugeProps['kind']): string {
    if (kind === 'risk') return score <= 30 ? '#10b981' : score <= 60 ? '#f59e0b' : '#ef4444';
    return score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444';
}

export function ScoreGauge({ score, label, sublabel, kind, size = 120 }: ScoreGaugeProps) {
    const circumference = Math.PI * 45; // half-circle arc
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className="flex flex-col items-center gap-1">
            <svg width={size} height={size * 0.7} viewBox="0 0 120 80" role="img" aria-label={`${label}: ${score} out of 100`}>
                {/* Background arc */}
                <path
                    d="M 15 65 A 45 45 0 0 1 105 65"
                    fill="none"
                    stroke="#30363d"
                    strokeWidth="10"
                    strokeLinecap="round"
                />
                {/* Score arc */}
                <path
                    d="M 15 65 A 45 45 0 0 1 105 65"
                    fill="none"
                    stroke={gaugeColor(score, kind)}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className="transition-all duration-1000 ease-out"
                />
                {/* Score value */}
                <text x="60" y="62" textAnchor="middle" fontSize="22" fontWeight="700" fill="white" fontFamily="Inter">
                    {score}
                </text>
            </svg>
            <span className="text-xs font-semibold text-slate-300 text-center">{label}</span>
            {sublabel && <span className="text-xs text-slate-500 text-center">{sublabel}</span>}
        </div>
    );
}
