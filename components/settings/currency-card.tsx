"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getBudget, setCurrency } from "@/lib/firebase/db";
import { CURRENCIES, resolveCurrency, formatAmount } from "@/lib/currency";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/ui/toast-provider";

export function CurrencyCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [code, setCode] = useState<string>("USD");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const budget = await getBudget(user.uid);
      setCode(resolveCurrency(budget).code);
      setLoaded(true);
    })();
  }, [user]);

  async function handleChange(next: string) {
    if (!user) return;
    setCode(next);
    await setCurrency(user.uid, next);
    const cur = CURRENCIES.find((c) => c.code === next);
    toast({
      title: `Currency set to ${next}`,
      description: cur
        ? `Amounts now display like ${formatAmount(120, cur)}. Existing values keep their numbers.`
        : undefined,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Currency</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Display currency</p>
          <p className="text-sm text-muted-foreground">
            Used everywhere money is shown — expenses, budgets, money goals.
            Changing it switches the symbol only (no conversion).
          </p>
        </div>
        <Select value={code} onValueChange={handleChange} disabled={!loaded}>
          <SelectTrigger className="w-44 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code} — {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
