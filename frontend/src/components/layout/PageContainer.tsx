import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Consistent page wrapper with max-width and padding.
 * Ensures all pages share the same layout boundary.
 */
export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        "max-w-[1600px] mx-auto w-full p-4 md:p-6 lg:p-8",
        className
      )}
    >
      {children}
    </div>
  );
}
