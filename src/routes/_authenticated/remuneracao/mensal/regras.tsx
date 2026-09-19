









import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Copy, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useAccess } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { brl } from "@/lib/format";
export const Route = createFileRoute("/_authenticated/remuneracao/mensal/regras")({
  head: () => ({
    meta: [
      { title: "Motor de regras | PRISMA" },
      {
        name: "description",
        content:
          "Configure versões trimestrais, gatilhos, pesos e valores dos indicadores de bônus por cargo, sem alterar históricos.",
      },
      { property: "og:title", content: "Motor de regras | PRISMA" },
      { property: "og:description", content: "Configure versões trimestrais, gatilhos, pesos e valores dos indicadores de bônus por cargo, sem alterar históricos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegrasPage,
});
type Version = {
  id: string;
  name: string;
  year: number;
  quarter: number;
  status: "rascunho" | "publicada" | "arquivada";
