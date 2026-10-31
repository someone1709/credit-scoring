import { useEffect, useRef } from 'react';

interface ScoreGaugeProps {
    score: number;         // 0–100
    label: string;
    sublabel?: string;
    colorClass?: string;   // e.g. 'stroke-emerald-500'
    size?: number;
}

export function ScoreGauge({ score, label, sublabel, colorClass = 'stroke-emerald-500', size = 120 }: ScoreGaugeProps) {
    const circleRef = useRef<SVGCircleElement>(null);
    const r = 45;
    const cx = 60;
    const cy = 60;
    const circumference = Math.PI * r; // half-circle arc

    useEffect(() => {
        if (circleRef.current) {
            const offset = circumference - (score / 100) * circumference;
            circleRef.current.style.strokeDashoffset = `${offset}`;
        }
    }, [score, circumference]);

    const scoreColor = score <= 30 ? '#10b981' : score <= 60 ? '#f59e0b' : '#ef4444';

    return (
        <div className="flex flex-col items-center gap-1">
            <svg width={size} height={size * 0.7} viewBox="0 0 120 80">
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
                    stroke={scoreColor}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - (score / 100) * circumference}
                    className={`transition-all duration-1000 ease-out ${colorClass}`}
                    style={{ strokeDashoffset: circumference - (score / 100) * circumference }}
                />
                {/* Score value */}
                <text x="60" y="62" textAnchor="middle" fontSize="22" fontWeight="700" fill="white" fontFamily="Inter">
                    {score}
                </text>
            </svg>
            <span className="text-xs font-semibold text-slate-300">{label}</span>
            {sublabel && <span className="text-xs text-slate-500">{sublabel}</span>}
        </div>
    );
}
