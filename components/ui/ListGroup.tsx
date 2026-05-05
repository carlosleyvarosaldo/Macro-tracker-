import { ReactNode } from "react";

type Props = {
  header?: string;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function ListGroup({ header, footer, children, className = "" }: Props) {
  return (
    <div className={className}>
      {header && (
        <p className="px-4 mb-1.5 text-[13px] uppercase tracking-wide text-gray-500 font-medium">
          {header}
        </p>
      )}
      <div className="bg-white rounded-xl overflow-hidden border border-gray-200/70">
        {/* Children get separator between them via :not(:first-child) */}
        <div className="divide-y divide-gray-200/70">{children}</div>
      </div>
      {footer && (
        <p className="px-4 mt-1.5 text-[13px] text-gray-500 leading-snug">
          {footer}
        </p>
      )}
    </div>
  );
}