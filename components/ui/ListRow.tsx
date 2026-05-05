"use client";

import { ReactNode, MouseEventHandler, KeyboardEvent } from "react";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  detail?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onClick?: MouseEventHandler<HTMLDivElement>;
  /** Show chevron on the right (auto-true if onClick is provided and no trailing override). */
  chevron?: boolean;
  destructive?: boolean;
  className?: string;
};

export default function ListRow({
  title,
  subtitle,
  detail,
  leading,
  trailing,
  onClick,
  chevron,
  destructive,
  className = "",
}: Props) {
  const showChevron =
    chevron ?? (typeof onClick === "function" && !trailing);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      // Synthesize a click — onClick expects a MouseEvent type signature
      onClick(e as unknown as Parameters<typeof onClick>[0]);
    }
  };

  const interactive = typeof onClick === "function";

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? handleKeyDown : undefined}
      className={`w-full px-4 py-3 ${
        interactive ? "cursor-pointer active:bg-gray-100" : ""
      } ${className}`}
    >
      <div className="flex items-center gap-3 w-full min-w-0">
        {leading && <div className="flex-shrink-0">{leading}</div>}
        <div className="flex-1 min-w-0">
          <div
            className={`text-[15px] leading-tight font-medium truncate ${
              destructive ? "text-red-600" : "text-gray-900"
            }`}
          >
            {title}
          </div>
          {subtitle && (
            <div className="text-[13px] text-gray-500 mt-0.5 truncate">
              {subtitle}
            </div>
          )}
        </div>
        {detail !== undefined && (
          <div className="text-[15px] text-gray-400 flex-shrink-0">{detail}</div>
        )}
        {trailing && <div className="flex-shrink-0">{trailing}</div>}
        {showChevron && (
          <svg
            width="8"
            height="13"
            viewBox="0 0 8 13"
            fill="none"
            className="text-gray-300 flex-shrink-0"
            aria-hidden="true"
          >
            <path
              d="M1.5 1.5L6.5 6.5L1.5 11.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </div>
  );
}