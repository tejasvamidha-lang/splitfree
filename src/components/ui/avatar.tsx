import Image from "next/image";

import { cn, initials } from "@/lib/utils";

type AvatarProps = {
  name: string;
  avatarUrl?: string | null;
  className?: string;
};

export function Avatar({ name, avatarUrl, className }: AvatarProps) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={36}
        height={36}
        unoptimized
        className={cn("h-9 w-9 rounded-full object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700",
        className
      )}
      aria-label={name}
    >
      {initials(name)}
    </div>
  );
}
