"use client";

type Props = {
  message: string;
  variant?: "default" | "success" | "error";
};

export default function Toast({ message, variant = "default" }: Props) {
  const bg =
    variant === "error"
      ? "bg-red-600"
      : variant === "success"
      ? "bg-emerald-600"
      : "bg-gray-900";
  return (
    <div
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 max-w-[90%] z-30 ${bg} text-white text-[14px] font-medium rounded-2xl px-4 py-2.5 shadow-xl pointer-events-none`}
      role="status"
    >
      {message}
    </div>
  );
}