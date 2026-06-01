import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[rgba(212,168,83,0.1)]", className)}
      {...props}
    />
  )
}

export { Skeleton }
