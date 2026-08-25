export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          description: string | null
          entity: string | null
          entity_id: string | null
          field: string | null
          id: string
          new_value: string | null
          old_value: string | null
          period_id: string | null
          store_id: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          entity?: string | null
          entity_id?: string | null
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          period_id?: string | null
          store_id?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          entity?: string | null
          entity_id?: string | null
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          period_id?: string | null
          store_id?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      benefits: {
        Row: {
          benefit_type: string | null
          company_value: number | null
          competence: string | null
          created_at: string
          employee_discount: number | null
          employee_id: string
          id: string
          store_id: string | null
          value: number | null
        }
        Insert: {
          benefit_type?: string | null
          company_value?: number | null
          competence?: string | null
          created_at?: string
          employee_discount?: number | null
          employee_id: string
          id?: string
          store_id?: string | null
          value?: number | null
        }
        Update: {
          benefit_type?: string | null
          company_value?: number | null
          competence?: string | null
          created_at?: string
          employee_discount?: number | null
          employee_id?: string
          id?: string
          store_id?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "benefits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_criteria: {
        Row: {
          active: boolean
          category: string | null
          code: string | null
          comparator: string | null
          created_at: string
          description: string | null
          eliminatory_action: string | null
          id: string
          is_eliminatory: boolean
          is_required: boolean
          metric_type: string
          name: string
          notes: string | null
          position_id: string | null
          requires_justification: boolean
          sort_order: number
          target_text: string | null
          target_value: number | null
          unit: string | null
          updated_at: string
          value_brl: number | null
          version_id: string
          weight_pct: number | null
        }
        Insert: {
          active?: boolean
          category?: string | null
          code?: string | null
          comparator?: string | null
          created_at?: string
          description?: string | null
          eliminatory_action?: string | null
          id?: string
          is_eliminatory?: boolean
          is_required?: boolean
          metric_type?: string
          name: string
          notes?: string | null
          position_id?: string | null
          requires_justification?: boolean
          sort_order?: number
          target_text?: string | null
          target_value?: number | null
          unit?: string | null
          updated_at?: string
          value_brl?: number | null
          version_id: string
          weight_pct?: number | null
        }
        Update: {
          active?: boolean
          category?: string | null
          code?: string | null
          comparator?: string | null
          created_at?: string
          description?: string | null
          eliminatory_action?: string | null
          id?: string
          is_eliminatory?: boolean
          is_required?: boolean
          metric_type?: string
          name?: string
          notes?: string | null
          position_id?: string | null
          requires_justification?: boolean
          sort_order?: number
          target_text?: string | null
          target_value?: number | null
          unit?: string | null
          updated_at?: string
          value_brl?: number | null
          version_id?: string
          weight_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bonus_criteria_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_criteria_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "bonus_rule_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          id: string
          month: number
          paid_at: string | null
          quarter: number | null
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["period_status"]
          store_id: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
          version_id: string | null
          year: number
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          month: number
          paid_at?: string | null
          quarter?: number | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["period_status"]
          store_id: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          version_id?: string | null
          year: number
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          month?: number
          paid_at?: string | null
          quarter?: number | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["period_status"]
          store_id?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          version_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "bonus_periods_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_periods_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "bonus_rule_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_rule_versions: {
        Row: {
          alert_pct: number
          created_at: string
          created_by: string | null
          ends_on: string | null
          id: string
          min_trigger_pct: number
          name: string
          notes: string | null
          published_at: string | null
          quarter: number
          starts_on: string | null
          status: Database["public"]["Enums"]["version_status"]
          target_pct: number
          updated_at: string
          year: number
        }
        Insert: {
          alert_pct?: number
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          min_trigger_pct?: number
          name: string
          notes?: string | null
          published_at?: string | null
          quarter: number
          starts_on?: string | null
          status?: Database["public"]["Enums"]["version_status"]
          target_pct?: number
          updated_at?: string
          year: number
        }
        Update: {
          alert_pct?: number
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          min_trigger_pct?: number
          name?: string
          notes?: string | null
          published_at?: string | null
          quarter?: number
          starts_on?: string | null
          status?: Database["public"]["Enums"]["version_status"]
          target_pct?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      employee_criterion_results: {
        Row: {
          created_at: string
          criterion_id: string
          entry_id: string
          id: string
          note: string | null
          result_value: number | null
          status: Database["public"]["Enums"]["criterion_status"]
          updated_at: string
          value_awarded: number
        }
        Insert: {
          created_at?: string
          criterion_id: string
          entry_id: string
          id?: string
          note?: string | null
          result_value?: number | null
          status?: Database["public"]["Enums"]["criterion_status"]
          updated_at?: string
          value_awarded?: number
        }
        Update: {
          created_at?: string
          criterion_id?: string
          entry_id?: string
          id?: string
          note?: string | null
          result_value?: number | null
          status?: Database["public"]["Enums"]["criterion_status"]
          updated_at?: string
          value_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_criterion_results_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "bonus_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_criterion_results_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "employee_period_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_period_entries: {
        Row: {
          approved_value: number | null
          base_value: number | null
          calc_snapshot: Json | null
          calculated_at: string | null
          calculated_by: string | null
          calculated_value: number
          created_at: string
          employee_id: string
          id: string
          no_bonus: boolean
          no_bonus_reason: string | null
          notes: string | null
          period_id: string
          position_id: string | null
          result_status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          approved_value?: number | null
          base_value?: number | null
          calc_snapshot?: Json | null
          calculated_at?: string | null
          calculated_by?: string | null
          calculated_value?: number
          created_at?: string
          employee_id: string
          id?: string
          no_bonus?: boolean
          no_bonus_reason?: string | null
          notes?: string | null
          period_id: string
          position_id?: string | null
          result_status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          approved_value?: number | null
          base_value?: number | null
          calc_snapshot?: Json | null
          calculated_at?: string | null
          calculated_by?: string | null
          calculated_value?: number
          created_at?: string
          employee_id?: string
          id?: string
          no_bonus?: boolean
          no_bonus_reason?: string | null
          notes?: string | null
          period_id?: string
          position_id?: string | null
          result_status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_period_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_period_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "bonus_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_period_entries_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_period_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          bonus_eligible: boolean
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string
          hired_at: string | null
          id: string
          ineligibility_reason: string | null
          notes: string | null
          phone: string | null
          position_id: string | null
          registration: string | null
          store_id: string
          terminated_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          bonus_eligible?: boolean
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          hired_at?: string | null
          id?: string
          ineligibility_reason?: string | null
          notes?: string | null
          phone?: string | null
          position_id?: string | null
          registration?: string | null
          store_id: string
          terminated_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          bonus_eligible?: boolean
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          hired_at?: string | null
          id?: string
          ineligibility_reason?: string | null
          notes?: string | null
          phone?: string | null
          position_id?: string | null
          registration?: string | null
          store_id?: string
          terminated_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          active: boolean
          base_value: number | null
          created_at: string
          description: string | null
          group_name: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_value?: number | null
          created_at?: string
          description?: string | null
          group_name?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_value?: number | null
          created_at?: string
          description?: string | null
          group_name?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      revenue_history: {
        Row: {
          created_at: string
          faturamento_base_meta: number | null
          id: string
          imported_at: string
          imported_by: string | null
          month: number
          receita_vendas: number
          source_file: string | null
          store_id: string
          taxa_servico: number
          tc: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          faturamento_base_meta?: number | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          month: number
          receita_vendas?: number
          source_file?: string | null
          store_id: string
          taxa_servico?: number
          tc?: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          faturamento_base_meta?: number | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          month?: number
          receita_vendas?: number
          source_file?: string | null
          store_id?: string
          taxa_servico?: number
          tc?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "revenue_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      secullum_records: {
        Row: {
          employee_id: string | null
          id: string
          imported_at: string
          payload: Json | null
          quantity: number | null
          record_date: string | null
          record_type: string | null
          store_id: string | null
        }
        Insert: {
          employee_id?: string | null
          id?: string
          imported_at?: string
          payload?: Json | null
          quantity?: number | null
          record_date?: string | null
          record_type?: string | null
          store_id?: string | null
        }
        Update: {
          employee_id?: string | null
          id?: string
          imported_at?: string
          payload?: Json | null
          quantity?: number | null
          record_date?: string | null
          record_type?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "secullum_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secullum_records_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_evaluations: {
        Row: {
          created_at: string
          created_by: string | null
          eval_date: string
          id: string
          score: number | null
          scores: Json | null
          store_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          eval_date: string
          id?: string
          score?: number | null
          scores?: Json | null
          store_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          eval_date?: string
          id?: string
          score?: number | null
          scores?: Json | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_evaluations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_feedback: {
        Row: {
          action_plan: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          feedback: string | null
          feedback_date: string
          id: string
          status: string | null
          store_id: string
        }
        Insert: {
          action_plan?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          feedback?: string | null
          feedback_date: string
          id?: string
          status?: string | null
          store_id: string
        }
        Update: {
          action_plan?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          feedback?: string | null
          feedback_date?: string
          id?: string
          status?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_feedback_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_goals: {
        Row: {
          base_year: number
          created_at: string
          faturamento_base_ano_anterior: number
          generated_at: string
          generated_by: string | null
          growth_fat_pct: number
          growth_tc_pct: number
          id: string
          meta_faturamento: number
          meta_tc: number
          month: number
          store_id: string
          tc_ano_anterior: number
          updated_at: string
          version: number
          year: number
        }
        Insert: {
          base_year: number
          created_at?: string
          faturamento_base_ano_anterior?: number
          generated_at?: string
          generated_by?: string | null
          growth_fat_pct?: number
          growth_tc_pct?: number
          id?: string
          meta_faturamento?: number
          meta_tc?: number
          month: number
          store_id: string
          tc_ano_anterior?: number
          updated_at?: string
          version?: number
          year: number
        }
        Update: {
          base_year?: number
          created_at?: string
          faturamento_base_ano_anterior?: number
          generated_at?: string
          generated_by?: string | null
          growth_fat_pct?: number
          growth_tc_pct?: number
          id?: string
          meta_faturamento?: number
          meta_tc?: number
          month?: number
          store_id?: string
          tc_ano_anterior?: number
          updated_at?: string
          version?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_goals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_targets: {
        Row: {
          base_history: number | null
          created_at: string
          growth_pct: number | null
          id: string
          manager_note: string | null
          notes: string | null
          period_id: string
          revenue_actual: number | null
          target_adjusted: number | null
          target_calculated: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_history?: number | null
          created_at?: string
          growth_pct?: number | null
          id?: string
          manager_note?: string | null
          notes?: string | null
          period_id: string
          revenue_actual?: number | null
          target_adjusted?: number | null
          target_calculated?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_history?: number | null
          created_at?: string
          growth_pct?: number | null
          id?: string
          manager_note?: string | null
          notes?: string | null
          period_id?: string
          revenue_actual?: number | null
          target_adjusted?: number | null
          target_calculated?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_targets_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: true
            referencedRelation: "bonus_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          active: boolean
          city: string | null
          cnpj: string | null
          code: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          started_at: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          city?: string | null
          cnpj?: string | null
          code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          started_at?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string | null
          cnpj?: string | null
          code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          started_at?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trainings: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          instructor: string | null
          next_training: string | null
          notes: string | null
          score: number | null
          status: string | null
          store_id: string | null
          training_date: string | null
          training_name: string | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          instructor?: string | null
          next_training?: string | null
          notes?: string | null
          score?: number | null
          status?: string | null
          store_id?: string | null
          training_date?: string | null
          training_name?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          instructor?: string | null
          next_training?: string | null
          notes?: string | null
          score?: number | null
          status?: string | null
          store_id?: string | null
          training_date?: string | null
          training_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_stores: {
        Row: {
          created_at: string
          id: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_store: { Args: { _store_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_master: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "master" | "gerente"
      criterion_status: "atingiu" | "nao_atingiu" | "nao_aplicavel"
      period_status:
        | "aberto"
        | "em_preenchimento"
        | "enviado"
        | "em_conferencia"
        | "correcao_solicitada"
        | "aprovado"
        | "fechado"
        | "pago"
      version_status: "rascunho" | "publicada" | "arquivada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["master", "gerente"],
      criterion_status: ["atingiu", "nao_atingiu", "nao_aplicavel"],
      period_status: [
        "aberto",
        "em_preenchimento",
        "enviado",
        "em_conferencia",
        "correcao_solicitada",
        "aprovado",
        "fechado",
        "pago",
      ],
      version_status: ["rascunho", "publicada", "arquivada"],
    },
  },
} as const
