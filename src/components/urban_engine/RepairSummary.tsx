import { ShieldCheck, AlertTriangle, Hammer } from 'lucide-react';
import { type RepairSummary as RepairSummaryType } from '@/stores/urban-engine-store';

interface RepairSummaryProps {
  summary: RepairSummaryType;
  onManualReviewClick?: () => void;
}

export function RepairSummary({ summary, onManualReviewClick }: RepairSummaryProps) {
  const items = [
    {
      label: 'Issues Detected',
      count: summary.detected,
      icon: AlertTriangle,
      colorClass: 'text-[#eb5757]',
      isClickable: false,
    },
    {
      label: 'Automatically Fixed',
      count: summary.auto_fixed,
      icon: Hammer,
      colorClass: 'text-[#27a644]',
      isClickable: false,
    },
    {
      label: 'Manual Review Required',
      count: summary.manual_review,
      icon: ShieldCheck,
      colorClass: 'text-[#02b8cc]',
      isClickable: true,
    },
  ];

  return (
    <div className="flex flex-col gap-4 py-2">
      <span className="text-xs font-semibold text-text-secondary uppercase tracking-[0.12em]">
        Network Repair Summary
      </span>
      
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const clickableProps = item.isClickable && onManualReviewClick ? {
            onClick: onManualReviewClick,
            role: 'button',
            tabIndex: 0,
            className: 'flex flex-col p-2.5 rounded-control bg-bg-secondary border border-[#02b8cc]/30 text-center align-middle justify-center gap-1 transition-all hover:bg-[#02b8cc]/10 hover:border-[#02b8cc] active:scale-95 cursor-pointer select-none',
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onManualReviewClick();
              }
            }
          } : {
            className: 'flex flex-col p-2.5 rounded-control bg-bg-secondary border border-border-primary text-center align-middle justify-center gap-1 select-none'
          };

          return (
            <div 
              key={item.label} 
              {...clickableProps}
            >
              <div className="flex justify-center">
                <Icon size={14} className={item.colorClass} />
              </div>
              <span className="text-lg font-bold font-mono text-text-primary">
                {item.count}
              </span>
              <span className="text-[10px] leading-tight text-text-tertiary font-medium">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default RepairSummary;
