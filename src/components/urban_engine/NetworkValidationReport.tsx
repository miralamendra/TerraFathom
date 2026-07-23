import { AlertCircle, CheckCircle } from 'lucide-react';

interface NetworkValidationReportProps {
  warnings: Array<{ code: string; severity: string; message: string }>;
}

export function NetworkValidationReport({ warnings }: NetworkValidationReportProps) {
  if (!warnings || warnings.length === 0) {
    return (
      <div className="flex items-center gap-2 py-3 px-3 rounded-control bg-bg-secondary/40 border border-[#27a644]/20 text-xs">
        <CheckCircle size={14} className="text-[#27a644]" />
        <span className="text-[#27a644] font-medium">No network validation errors detected.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 py-2">
      <span className="text-xs font-semibold text-text-secondary uppercase tracking-[0.12em]">
        Validation Log
      </span>
      
      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
        {warnings.map((w, idx) => (
          <div 
            key={idx}
            className={`flex items-start gap-2.5 p-2.5 rounded-control text-xs border ${
              w.severity === 'error' 
                ? 'bg-bg-secondary border-[#eb5757]/20 text-text-primary' 
                : 'bg-bg-secondary border-[#02b8cc]/20 text-text-primary'
            }`}
          >
            <AlertCircle 
              size={14} 
              className={`shrink-0 mt-0.5 ${
                w.severity === 'error' ? 'text-[#eb5757]' : 'text-[#02b8cc]'
              }`} 
            />
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-[11px] uppercase tracking-wider text-text-secondary font-mono">
                {w.code.replace(/_/g, ' ')}
              </span>
              <span className="text-text-primary font-medium leading-relaxed">
                {w.message}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export default NetworkValidationReport;
