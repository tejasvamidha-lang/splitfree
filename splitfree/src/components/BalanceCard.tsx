import { ArrowDownCircle, ArrowUpCircle, Scale } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

type BalanceTone = "owed" | "owe" | "net";

type BalanceCardProps = {
  label: string;
  amount: number;
  tone: BalanceTone;
};

const toneStyles: Record<BalanceTone, string> = {
  owed: "bg-emerald-50 border-emerald-200 text-emerald-800",
  owe: "bg-rose-50 border-rose-200 text-rose-800",
  net: "bg-sky-50 border-sky-200 text-sky-800",
};

const toneIcon: Record<BalanceTone, ReactNode> = {
  owed: <ArrowUpCircle className="h-4 w-4" />,
  owe: <ArrowDownCircle className="h-4 w-4" />,
  net: <Scale className="h-4 w-4" />,
};

export function BalanceCard({ label, amount, tone }: BalanceCardProps) {
  return (
    <Card className={toneStyles[tone]}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          {toneIcon[tone]}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-extrabold tracking-tight">{formatCurrency(amount)}</p>
      </CardContent>
    </Card>
  );
}
