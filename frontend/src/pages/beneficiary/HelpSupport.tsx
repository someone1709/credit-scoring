import { Card } from '@/components/shared/UI';
import { HelpCircle, Mail, BookOpen, MessageCircle } from 'lucide-react';

const faqs = [
    { q: 'What is BeneScore?', a: 'BeneScore is an academic prototype of an AI-powered digital lending platform that connects beneficiaries with independent lenders using alternative credit scoring.' },
    { q: 'How is my credit score calculated?', a: 'The score uses rule-based financial indicators including your debt-to-income ratio, expense-to-income ratio, monthly surplus, and repayment history. It is illustrative only.' },
    { q: 'Does "no repayment history" hurt my score?', a: 'No. First-time borrowers with no history are not penalised. The system explicitly distinguishes between no history and poor history.' },
    { q: 'Can multiple lenders review my application?', a: 'Yes. Multiple lenders can independently review your application. One rejection does not affect other lenders\' assessments.' },
    { q: 'Is this a real lending platform?', a: 'No. This is an academic prototype. All data is synthetic. No real loans are disbursed and no money is transferred.' },
];

export default function HelpSupport() {
    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Help & Support</h1>
                <p className="text-slate-500 mt-1 text-sm">FAQs and contact information for the BeneScore platform.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { icon: Mail, label: 'Email Support', val: 'support@benescore.demo' },
                    { icon: BookOpen, label: 'Documentation', val: 'Academic prototype' },
                    { icon: MessageCircle, label: 'Community', val: 'CSE Minor Project' },
                ].map(({ icon: Icon, label, val }) => (
                    <Card key={label} className="flex flex-col items-center text-center py-5">
                        <Icon size={24} className="text-emerald-400 mb-2" />
                        <p className="text-sm font-semibold text-white">{label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{val}</p>
                    </Card>
                ))}
            </div>

            <Card>
                <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2"><HelpCircle size={16} /> Frequently Asked Questions</h2>
                <div className="space-y-4">
                    {faqs.map(({ q, a }) => (
                        <div key={q} className="border-b border-[#30363d] last:border-0 pb-4 last:pb-0">
                            <p className="text-sm font-semibold text-white mb-1">{q}</p>
                            <p className="text-sm text-slate-400">{a}</p>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
