export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.17';
  };
  public: {
    Tables: {
      action_plan_statuses: {
        Row: {
          created_at: string;
          header_background: string;
          header_border: string;
          header_foreground: string;
          is_active: boolean;
          is_initial: boolean;
          is_terminal: boolean;
          key: string;
          label: string;
          next_status_key: string | null;
          order_index: number;
        };
        Insert: {
          created_at?: string;
          header_background?: string;
          header_border?: string;
          header_foreground?: string;
          is_active?: boolean;
          is_initial?: boolean;
          is_terminal?: boolean;
          key: string;
          label: string;
          next_status_key?: string | null;
          order_index?: number;
        };
        Update: {
          created_at?: string;
          header_background?: string;
          header_border?: string;
          header_foreground?: string;
          is_active?: boolean;
          is_initial?: boolean;
          is_terminal?: boolean;
          key?: string;
          label?: string;
          next_status_key?: string | null;
          order_index?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'action_plan_statuses_next_status_key_fkey';
            columns: ['next_status_key'];
            isOneToOne: false;
            referencedRelation: 'action_plan_statuses';
            referencedColumns: ['key'];
          },
        ];
      };
      action_plans: {
        Row: {
          code: string;
          created_at: string | null;
          how: string | null;
          how_much: string | null;
          id: string;
          status: string;
          ticket_id: string;
          title: string;
          updated_at: string | null;
          what: string | null;
          when: string | null;
          where: string | null;
          who: string | null;
          why: string | null;
        };
        Insert: {
          code?: string;
          created_at?: string | null;
          how?: string | null;
          how_much?: string | null;
          id?: string;
          status: string;
          ticket_id: string;
          title: string;
          updated_at?: string | null;
          what?: string | null;
          when?: string | null;
          where?: string | null;
          who?: string | null;
          why?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string | null;
          how?: string | null;
          how_much?: string | null;
          id?: string;
          status?: string;
          ticket_id?: string;
          title?: string;
          updated_at?: string | null;
          what?: string | null;
          when?: string | null;
          where?: string | null;
          who?: string | null;
          why?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'action_plans_status_fkey';
            columns: ['status'];
            isOneToOne: false;
            referencedRelation: 'action_plan_statuses';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'action_plans_ticket_id_fkey';
            columns: ['ticket_id'];
            isOneToOne: false;
            referencedRelation: 'tickets';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_usage: {
        Row: {
          requests: number;
          user_id: string;
          window_start: string;
        };
        Insert: {
          requests?: number;
          user_id: string;
          window_start: string;
        };
        Update: {
          requests?: number;
          user_id?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      analysis_tools: {
        Row: {
          created_at: string;
          is_active: boolean;
          is_default: boolean;
          key: string;
          label: string;
          order_index: number;
          render_kind: string;
          requires_completion: boolean;
        };
        Insert: {
          created_at?: string;
          is_active?: boolean;
          is_default?: boolean;
          key: string;
          label: string;
          order_index?: number;
          render_kind?: string;
          requires_completion?: boolean;
        };
        Update: {
          created_at?: string;
          is_active?: boolean;
          is_default?: boolean;
          key?: string;
          label?: string;
          order_index?: number;
          render_kind?: string;
          requires_completion?: boolean;
        };
        Relationships: [];
      };
      controlled_copies: {
        Row: {
          created_at: string | null;
          delivery_date: string | null;
          document_id: string;
          id: string;
          request_date: string | null;
          return_date: string | null;
          status: Database['public']['Enums']['copy_status'];
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          delivery_date?: string | null;
          document_id: string;
          id?: string;
          request_date?: string | null;
          return_date?: string | null;
          status?: Database['public']['Enums']['copy_status'];
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          delivery_date?: string | null;
          document_id?: string;
          id?: string;
          request_date?: string | null;
          return_date?: string | null;
          status?: Database['public']['Enums']['copy_status'];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'controlled_copies_document_id_fkey';
            columns: ['document_id'];
            isOneToOne: false;
            referencedRelation: 'documents';
            referencedColumns: ['id'];
          },
        ];
      };
      dimension_classifications: {
        Row: {
          classification_key: string;
          created_at: string;
          icon: string;
          is_active: boolean;
          is_default: boolean;
          label: string;
          order_index: number;
        };
        Insert: {
          classification_key: string;
          created_at?: string;
          icon?: string;
          is_active?: boolean;
          is_default?: boolean;
          label: string;
          order_index?: number;
        };
        Update: {
          classification_key?: string;
          created_at?: string;
          icon?: string;
          is_active?: boolean;
          is_default?: boolean;
          label?: string;
          order_index?: number;
        };
        Relationships: [];
      };
      dimension_colors: {
        Row: {
          background_color: string;
          created_at: string;
          foreground_color: string;
          is_active: boolean;
          is_default: boolean;
          key: string;
          label: string;
          line_color: string;
          order_index: number;
        };
        Insert: {
          background_color: string;
          created_at?: string;
          foreground_color: string;
          is_active?: boolean;
          is_default?: boolean;
          key: string;
          label: string;
          line_color: string;
          order_index?: number;
        };
        Update: {
          background_color?: string;
          created_at?: string;
          foreground_color?: string;
          is_active?: boolean;
          is_default?: boolean;
          key?: string;
          label?: string;
          line_color?: string;
          order_index?: number;
        };
        Relationships: [];
      };
      dimension_links: {
        Row: {
          created_at: string | null;
          dimension_id: string;
          id: string;
          item_id: string;
          item_type: string;
          process_id: string;
          version_id: string;
        };
        Insert: {
          created_at?: string | null;
          dimension_id: string;
          id?: string;
          item_id: string;
          item_type: string;
          process_id: string;
          version_id: string;
        };
        Update: {
          created_at?: string | null;
          dimension_id?: string;
          id?: string;
          item_id?: string;
          item_type?: string;
          process_id?: string;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'dimension_links_dimension_id_fkey';
            columns: ['dimension_id'];
            isOneToOne: false;
            referencedRelation: 'dimensions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dimension_links_process_id_fkey';
            columns: ['process_id'];
            isOneToOne: false;
            referencedRelation: 'processes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dimension_links_version_id_fkey';
            columns: ['version_id'];
            isOneToOne: false;
            referencedRelation: 'dimension_versions';
            referencedColumns: ['id'];
          },
        ];
      };
      dimension_versions: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          label: string;
          version_number: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          label: string;
          version_number: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          label?: string;
          version_number?: number;
        };
        Relationships: [];
      };
      dimensions: {
        Row: {
          classification: Database['public']['Enums']['dimension_classification_type'] | null;
          classification_key: string;
          code: string;
          color_key: string;
          created_at: string | null;
          custom_fields: Json | null;
          description: string | null;
          id: string;
          name: string;
          objective: string | null;
          order_index: number | null;
          updated_at: string | null;
          version_id: string;
        };
        Insert: {
          classification?: Database['public']['Enums']['dimension_classification_type'] | null;
          classification_key?: string;
          code: string;
          color_key: string;
          created_at?: string | null;
          custom_fields?: Json | null;
          description?: string | null;
          id?: string;
          name: string;
          objective?: string | null;
          order_index?: number | null;
          updated_at?: string | null;
          version_id: string;
        };
        Update: {
          classification?: Database['public']['Enums']['dimension_classification_type'] | null;
          classification_key?: string;
          code?: string;
          color_key?: string;
          created_at?: string | null;
          custom_fields?: Json | null;
          description?: string | null;
          id?: string;
          name?: string;
          objective?: string | null;
          order_index?: number | null;
          updated_at?: string | null;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'dimensions_classification_key_fkey';
            columns: ['classification_key'];
            isOneToOne: false;
            referencedRelation: 'dimension_classifications';
            referencedColumns: ['classification_key'];
          },
          {
            foreignKeyName: 'dimensions_version_id_fkey';
            columns: ['version_id'];
            isOneToOne: false;
            referencedRelation: 'dimension_versions';
            referencedColumns: ['id'];
          },
        ];
      };
      document_types: {
        Row: {
          created_at: string | null;
          hierarchy_level: number;
          id: string;
          name: string;
          print_allowed: boolean;
          sla_approval_days: number;
          sla_review_days: number;
        };
        Insert: {
          created_at?: string | null;
          hierarchy_level?: number;
          id?: string;
          name: string;
          print_allowed?: boolean;
          sla_approval_days?: number;
          sla_review_days?: number;
        };
        Update: {
          created_at?: string | null;
          hierarchy_level?: number;
          id?: string;
          name?: string;
          print_allowed?: boolean;
          sla_approval_days?: number;
          sla_review_days?: number;
        };
        Relationships: [];
      };
      document_workflows: {
        Row: {
          changed_at: string | null;
          changed_by: string | null;
          document_id: string;
          from_status: Database['public']['Enums']['document_status'] | null;
          id: string;
          notes: string | null;
          sla_deadline: string | null;
          to_status: Database['public']['Enums']['document_status'];
        };
        Insert: {
          changed_at?: string | null;
          changed_by?: string | null;
          document_id: string;
          from_status?: Database['public']['Enums']['document_status'] | null;
          id?: string;
          notes?: string | null;
          sla_deadline?: string | null;
          to_status: Database['public']['Enums']['document_status'];
        };
        Update: {
          changed_at?: string | null;
          changed_by?: string | null;
          document_id?: string;
          from_status?: Database['public']['Enums']['document_status'] | null;
          id?: string;
          notes?: string | null;
          sla_deadline?: string | null;
          to_status?: Database['public']['Enums']['document_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'document_workflows_document_id_fkey';
            columns: ['document_id'];
            isOneToOne: false;
            referencedRelation: 'documents';
            referencedColumns: ['id'];
          },
        ];
      };
      documents: {
        Row: {
          code: string | null;
          created_at: string | null;
          drive_link: string | null;
          id: string;
          owner_id: string | null;
          print_allowed: boolean;
          process_id: string | null;
          status: Database['public']['Enums']['document_status'];
          title: string;
          type_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          code?: string | null;
          created_at?: string | null;
          drive_link?: string | null;
          id?: string;
          owner_id?: string | null;
          print_allowed?: boolean;
          process_id?: string | null;
          status?: Database['public']['Enums']['document_status'];
          title: string;
          type_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          code?: string | null;
          created_at?: string | null;
          drive_link?: string | null;
          id?: string;
          owner_id?: string | null;
          print_allowed?: boolean;
          process_id?: string | null;
          status?: Database['public']['Enums']['document_status'];
          title?: string;
          type_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'documents_process_id_fkey';
            columns: ['process_id'];
            isOneToOne: false;
            referencedRelation: 'processes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'documents_type_id_fkey';
            columns: ['type_id'];
            isOneToOne: false;
            referencedRelation: 'document_types';
            referencedColumns: ['id'];
          },
        ];
      };
      environmental_analyses: {
        Row: {
          apply_pestel: boolean | null;
          apply_porter: boolean | null;
          apply_swot: boolean | null;
          created_at: string | null;
          description: string | null;
          id: string;
          order_index: number | null;
          period: string | null;
          status: string;
          title: string;
          updated_at: string | null;
          valid_until: string | null;
        };
        Insert: {
          apply_pestel?: boolean | null;
          apply_porter?: boolean | null;
          apply_swot?: boolean | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          order_index?: number | null;
          period?: string | null;
          status?: string;
          title: string;
          updated_at?: string | null;
          valid_until?: string | null;
        };
        Update: {
          apply_pestel?: boolean | null;
          apply_porter?: boolean | null;
          apply_swot?: boolean | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          order_index?: number | null;
          period?: string | null;
          status?: string;
          title?: string;
          updated_at?: string | null;
          valid_until?: string | null;
        };
        Relationships: [];
      };
      environmental_tools: {
        Row: {
          analysis_id: string;
          created_at: string | null;
          id: string;
          linked_analysis_id: string;
          order_index: number | null;
          tool_type: string;
          updated_at: string | null;
        };
        Insert: {
          analysis_id: string;
          created_at?: string | null;
          id?: string;
          linked_analysis_id: string;
          order_index?: number | null;
          tool_type: string;
          updated_at?: string | null;
        };
        Update: {
          analysis_id?: string;
          created_at?: string | null;
          id?: string;
          linked_analysis_id?: string;
          order_index?: number | null;
          tool_type?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'environmental_tools_analysis_id_fkey';
            columns: ['analysis_id'];
            isOneToOne: false;
            referencedRelation: 'environmental_analyses';
            referencedColumns: ['id'];
          },
        ];
      };
      form_field_types: {
        Row: {
          created_at: string;
          is_active: boolean;
          key: string;
          label: string;
          order_index: number;
        };
        Insert: {
          created_at?: string;
          is_active?: boolean;
          key: string;
          label: string;
          order_index?: number;
        };
        Update: {
          created_at?: string;
          is_active?: boolean;
          key?: string;
          label?: string;
          order_index?: number;
        };
        Relationships: [];
      };
      helpdesk_categories: {
        Row: {
          created_at: string;
          is_active: boolean;
          is_default: boolean;
          key: string;
          label: string;
          order_index: number;
        };
        Insert: {
          created_at?: string;
          is_active?: boolean;
          is_default?: boolean;
          key: string;
          label: string;
          order_index?: number;
        };
        Update: {
          created_at?: string;
          is_active?: boolean;
          is_default?: boolean;
          key?: string;
          label?: string;
          order_index?: number;
        };
        Relationships: [];
      };
      helpdesk_priorities: {
        Row: {
          badge_background: string;
          badge_foreground: string;
          created_at: string;
          is_active: boolean;
          is_default: boolean;
          key: string;
          label: string;
          order_index: number;
        };
        Insert: {
          badge_background?: string;
          badge_foreground?: string;
          created_at?: string;
          is_active?: boolean;
          is_default?: boolean;
          key: string;
          label: string;
          order_index?: number;
        };
        Update: {
          badge_background?: string;
          badge_foreground?: string;
          created_at?: string;
          is_active?: boolean;
          is_default?: boolean;
          key?: string;
          label?: string;
          order_index?: number;
        };
        Relationships: [];
      };
      helpdesk_statuses: {
        Row: {
          created_at: string;
          header_background: string;
          header_border: string;
          header_foreground: string;
          is_active: boolean;
          is_initial: boolean;
          is_terminal: boolean;
          key: string;
          label: string;
          next_status_key: string | null;
          order_index: number;
        };
        Insert: {
          created_at?: string;
          header_background?: string;
          header_border?: string;
          header_foreground?: string;
          is_active?: boolean;
          is_initial?: boolean;
          is_terminal?: boolean;
          key: string;
          label: string;
          next_status_key?: string | null;
          order_index?: number;
        };
        Update: {
          created_at?: string;
          header_background?: string;
          header_border?: string;
          header_foreground?: string;
          is_active?: boolean;
          is_initial?: boolean;
          is_terminal?: boolean;
          key?: string;
          label?: string;
          next_status_key?: string | null;
          order_index?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'helpdesk_statuses_next_status_key_fkey';
            columns: ['next_status_key'];
            isOneToOne: false;
            referencedRelation: 'helpdesk_statuses';
            referencedColumns: ['key'];
          },
        ];
      };
      helpdesk_tickets: {
        Row: {
          assigned_to: string | null;
          category: string;
          code: string | null;
          created_at: string | null;
          created_by: string | null;
          custom_fields: Json | null;
          description: string | null;
          id: string;
          priority: string;
          process_id: string | null;
          requester_name: string | null;
          status: string;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          assigned_to?: string | null;
          category?: string;
          code?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          custom_fields?: Json | null;
          description?: string | null;
          id?: string;
          priority?: string;
          process_id?: string | null;
          requester_name?: string | null;
          status: string;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          assigned_to?: string | null;
          category?: string;
          code?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          custom_fields?: Json | null;
          description?: string | null;
          id?: string;
          priority?: string;
          process_id?: string | null;
          requester_name?: string | null;
          status?: string;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'helpdesk_tickets_category_fkey';
            columns: ['category'];
            isOneToOne: false;
            referencedRelation: 'helpdesk_categories';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'helpdesk_tickets_priority_fkey';
            columns: ['priority'];
            isOneToOne: false;
            referencedRelation: 'helpdesk_priorities';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'helpdesk_tickets_process_id_fkey';
            columns: ['process_id'];
            isOneToOne: false;
            referencedRelation: 'processes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'helpdesk_tickets_status_fkey';
            columns: ['status'];
            isOneToOne: false;
            referencedRelation: 'helpdesk_statuses';
            referencedColumns: ['key'];
          },
        ];
      };
      indicator_definition_history: {
        Row: {
          action: string;
          after_data: Json;
          before_data: Json | null;
          changed_at: string;
          changed_by: string | null;
          id: string;
          indicator_id: string;
          justification: string | null;
        };
        Insert: {
          action: string;
          after_data: Json;
          before_data?: Json | null;
          changed_at?: string;
          changed_by?: string | null;
          id?: string;
          indicator_id: string;
          justification?: string | null;
        };
        Update: {
          action?: string;
          after_data?: Json;
          before_data?: Json | null;
          changed_at?: string;
          changed_by?: string | null;
          id?: string;
          indicator_id?: string;
          justification?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'indicator_definition_history_indicator_id_fkey';
            columns: ['indicator_id'];
            isOneToOne: false;
            referencedRelation: 'indicators';
            referencedColumns: ['id'];
          },
        ];
      };
      indicator_dependencies: {
        Row: {
          indicator_id: string;
          source_indicator_id: string;
        };
        Insert: {
          indicator_id: string;
          source_indicator_id: string;
        };
        Update: {
          indicator_id?: string;
          source_indicator_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'indicator_dependencies_indicator_id_fkey';
            columns: ['indicator_id'];
            isOneToOne: false;
            referencedRelation: 'indicators';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'indicator_dependencies_source_indicator_id_fkey';
            columns: ['source_indicator_id'];
            isOneToOne: false;
            referencedRelation: 'indicators';
            referencedColumns: ['id'];
          },
        ];
      };
      indicator_history: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          goal: number;
          id: string;
          indicator_id: string;
          late_justification: string | null;
          period: string;
          period_date: string | null;
          value: number;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          goal: number;
          id?: string;
          indicator_id: string;
          late_justification?: string | null;
          period: string;
          period_date?: string | null;
          value: number;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          goal?: number;
          id?: string;
          indicator_id?: string;
          late_justification?: string | null;
          period?: string;
          period_date?: string | null;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'indicator_history_indicator_id_fkey';
            columns: ['indicator_id'];
            isOneToOne: false;
            referencedRelation: 'indicators';
            referencedColumns: ['id'];
          },
        ];
      };
      indicator_result_analyses: {
        Row: {
          action_plan_ids: string[];
          created_at: string;
          created_by: string;
          diagnostic: string;
          history_id: string | null;
          id: string;
          indicator_id: string;
          observed_goal: number;
          observed_period: string;
          observed_value: number;
          suggestions: Json;
        };
        Insert: {
          action_plan_ids?: string[];
          created_at?: string;
          created_by?: string;
          diagnostic: string;
          history_id?: string | null;
          id?: string;
          indicator_id: string;
          observed_goal: number;
          observed_period: string;
          observed_value: number;
          suggestions?: Json;
        };
        Update: {
          action_plan_ids?: string[];
          created_at?: string;
          created_by?: string;
          diagnostic?: string;
          history_id?: string | null;
          id?: string;
          indicator_id?: string;
          observed_goal?: number;
          observed_period?: string;
          observed_value?: number;
          suggestions?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'indicator_result_analyses_history_id_fkey';
            columns: ['history_id'];
            isOneToOne: false;
            referencedRelation: 'indicator_history';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'indicator_result_analyses_indicator_id_fkey';
            columns: ['indicator_id'];
            isOneToOne: false;
            referencedRelation: 'indicators';
            referencedColumns: ['id'];
          },
        ];
      };
      indicator_statuses: {
        Row: {
          badge_background: string;
          badge_foreground: string;
          created_at: string;
          is_active: boolean;
          is_critical: boolean;
          is_default: boolean;
          is_problem: boolean;
          is_target: boolean;
          key: string;
          label: string;
          min_goal_ratio: number | null;
          order_index: number;
        };
        Insert: {
          badge_background?: string;
          badge_foreground?: string;
          created_at?: string;
          is_active?: boolean;
          is_critical?: boolean;
          is_default?: boolean;
          is_problem?: boolean;
          is_target?: boolean;
          key: string;
          label: string;
          min_goal_ratio?: number | null;
          order_index?: number;
        };
        Update: {
          badge_background?: string;
          badge_foreground?: string;
          created_at?: string;
          is_active?: boolean;
          is_critical?: boolean;
          is_default?: boolean;
          is_problem?: boolean;
          is_target?: boolean;
          key?: string;
          label?: string;
          min_goal_ratio?: number | null;
          order_index?: number;
        };
        Relationships: [];
      };
      indicators: {
        Row: {
          acceptable_variation: number;
          calculation_type: string;
          code: string;
          created_at: string | null;
          current_value: number;
          decimal_places: number;
          dimension_id: string | null;
          formula_expression: string;
          formula_tokens: Json;
          frequency: Database['public']['Enums']['indicator_frequency_type'] | null;
          goal_direction: string;
          goal_value: number;
          id: string;
          indicator_type: string;
          objective: string;
          obsolete: boolean;
          process_id: string;
          requires_critical_analysis: boolean;
          result_source: string;
          simple_formula: string;
          status: string;
          step_id: string | null;
          strategic: boolean;
          title: string;
          unit: Database['public']['Enums']['indicator_unit_type'];
          updated_at: string | null;
        };
        Insert: {
          acceptable_variation?: number;
          calculation_type?: string;
          code?: string;
          created_at?: string | null;
          current_value: number;
          decimal_places?: number;
          dimension_id?: string | null;
          formula_expression?: string;
          formula_tokens?: Json;
          frequency?: Database['public']['Enums']['indicator_frequency_type'] | null;
          goal_direction?: string;
          goal_value: number;
          id?: string;
          indicator_type?: string;
          objective?: string;
          obsolete?: boolean;
          process_id: string;
          requires_critical_analysis?: boolean;
          result_source?: string;
          simple_formula?: string;
          status: string;
          step_id?: string | null;
          strategic?: boolean;
          title: string;
          unit: Database['public']['Enums']['indicator_unit_type'];
          updated_at?: string | null;
        };
        Update: {
          acceptable_variation?: number;
          calculation_type?: string;
          code?: string;
          created_at?: string | null;
          current_value?: number;
          decimal_places?: number;
          dimension_id?: string | null;
          formula_expression?: string;
          formula_tokens?: Json;
          frequency?: Database['public']['Enums']['indicator_frequency_type'] | null;
          goal_direction?: string;
          goal_value?: number;
          id?: string;
          indicator_type?: string;
          objective?: string;
          obsolete?: boolean;
          process_id?: string;
          requires_critical_analysis?: boolean;
          result_source?: string;
          simple_formula?: string;
          status?: string;
          step_id?: string | null;
          strategic?: boolean;
          title?: string;
          unit?: Database['public']['Enums']['indicator_unit_type'];
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'indicators_dimension_id_fkey';
            columns: ['dimension_id'];
            isOneToOne: false;
            referencedRelation: 'dimensions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'indicators_process_id_fkey';
            columns: ['process_id'];
            isOneToOne: false;
            referencedRelation: 'processes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'indicators_status_fkey';
            columns: ['status'];
            isOneToOne: false;
            referencedRelation: 'indicator_statuses';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'indicators_step_id_fkey';
            columns: ['step_id'];
            isOneToOne: false;
            referencedRelation: 'sipoc_nodes';
            referencedColumns: ['id'];
          },
        ];
      };
      module_code_counters: {
        Row: {
          last_number: number;
          module_code: string;
          process_code: string;
        };
        Insert: {
          last_number: number;
          module_code: string;
          process_code: string;
        };
        Update: {
          last_number?: number;
          module_code?: string;
          process_code?: string;
        };
        Relationships: [];
      };
      notification_classifications: {
        Row: {
          active: boolean;
          analysis_tool: string;
          code: string | null;
          created_at: string | null;
          default_severity: string;
          description: string | null;
          form_schema: Json | null;
          id: string;
          name: string;
          requires_root_cause: boolean;
          sla_hours: number | null;
          updated_at: string | null;
        };
        Insert: {
          active?: boolean;
          analysis_tool: string;
          code?: string | null;
          created_at?: string | null;
          default_severity?: string;
          description?: string | null;
          form_schema?: Json | null;
          id?: string;
          name: string;
          requires_root_cause?: boolean;
          sla_hours?: number | null;
          updated_at?: string | null;
        };
        Update: {
          active?: boolean;
          analysis_tool?: string;
          code?: string | null;
          created_at?: string | null;
          default_severity?: string;
          description?: string | null;
          form_schema?: Json | null;
          id?: string;
          name?: string;
          requires_root_cause?: boolean;
          sla_hours?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_classifications_analysis_tool_fkey';
            columns: ['analysis_tool'];
            isOneToOne: false;
            referencedRelation: 'analysis_tools';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'notification_classifications_default_severity_fkey';
            columns: ['default_severity'];
            isOneToOne: false;
            referencedRelation: 'notification_severities';
            referencedColumns: ['key'];
          },
        ];
      };
      notification_severities: {
        Row: {
          badge_background: string;
          badge_foreground: string;
          created_at: string;
          is_active: boolean;
          is_default: boolean;
          key: string;
          label: string;
          order_index: number;
        };
        Insert: {
          badge_background?: string;
          badge_foreground?: string;
          created_at?: string;
          is_active?: boolean;
          is_default?: boolean;
          key: string;
          label: string;
          order_index?: number;
        };
        Update: {
          badge_background?: string;
          badge_foreground?: string;
          created_at?: string;
          is_active?: boolean;
          is_default?: boolean;
          key?: string;
          label?: string;
          order_index?: number;
        };
        Relationships: [];
      };
      notification_types: {
        Row: {
          active: boolean;
          analysis_tool: string;
          classification_id: string | null;
          code: string | null;
          created_at: string | null;
          custom_fields_schema: Json | null;
          default_severity: string;
          description: string | null;
          form_schema: Json | null;
          id: string;
          name: string;
          requires_root_cause: boolean;
          risk_id: string | null;
          sla_hours: number | null;
          sla_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          active?: boolean;
          analysis_tool: string;
          classification_id?: string | null;
          code?: string | null;
          created_at?: string | null;
          custom_fields_schema?: Json | null;
          default_severity?: string;
          description?: string | null;
          form_schema?: Json | null;
          id?: string;
          name: string;
          requires_root_cause?: boolean;
          risk_id?: string | null;
          sla_hours?: number | null;
          sla_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          active?: boolean;
          analysis_tool?: string;
          classification_id?: string | null;
          code?: string | null;
          created_at?: string | null;
          custom_fields_schema?: Json | null;
          default_severity?: string;
          description?: string | null;
          form_schema?: Json | null;
          id?: string;
          name?: string;
          requires_root_cause?: boolean;
          risk_id?: string | null;
          sla_hours?: number | null;
          sla_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_types_analysis_tool_fkey';
            columns: ['analysis_tool'];
            isOneToOne: false;
            referencedRelation: 'analysis_tools';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'notification_types_classification_id_fkey';
            columns: ['classification_id'];
            isOneToOne: false;
            referencedRelation: 'notification_classifications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notification_types_default_severity_fkey';
            columns: ['default_severity'];
            isOneToOne: false;
            referencedRelation: 'notification_severities';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'notification_types_risk_id_fkey';
            columns: ['risk_id'];
            isOneToOne: false;
            referencedRelation: 'risks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notification_types_sla_id_fkey';
            columns: ['sla_id'];
            isOneToOne: false;
            referencedRelation: 'slas';
            referencedColumns: ['id'];
          },
        ];
      };
      pestel_analyses: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          order_index: number | null;
          period: string | null;
          status: string;
          title: string;
          updated_at: string | null;
          valid_until: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          order_index?: number | null;
          period?: string | null;
          status?: string;
          title: string;
          updated_at?: string | null;
          valid_until?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          order_index?: number | null;
          period?: string | null;
          status?: string;
          title?: string;
          updated_at?: string | null;
          valid_until?: string | null;
        };
        Relationships: [];
      };
      pestel_items: {
        Row: {
          analysis_id: string;
          created_at: string | null;
          description: string | null;
          dimension: string;
          id: string;
          impact: number | null;
          observation: string | null;
          order_index: number | null;
          probability: number | null;
          relevance: number | null;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          analysis_id: string;
          created_at?: string | null;
          description?: string | null;
          dimension: string;
          id?: string;
          impact?: number | null;
          observation?: string | null;
          order_index?: number | null;
          probability?: number | null;
          relevance?: number | null;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          analysis_id?: string;
          created_at?: string | null;
          description?: string | null;
          dimension?: string;
          id?: string;
          impact?: number | null;
          observation?: string | null;
          order_index?: number | null;
          probability?: number | null;
          relevance?: number | null;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'pestel_items_analysis_id_fkey';
            columns: ['analysis_id'];
            isOneToOne: false;
            referencedRelation: 'pestel_analyses';
            referencedColumns: ['id'];
          },
        ];
      };
      porter_analyses: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          order_index: number | null;
          period: string | null;
          scope: string | null;
          sector: string | null;
          status: string;
          title: string;
          updated_at: string | null;
          valid_until: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          order_index?: number | null;
          period?: string | null;
          scope?: string | null;
          sector?: string | null;
          status?: string;
          title: string;
          updated_at?: string | null;
          valid_until?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          order_index?: number | null;
          period?: string | null;
          scope?: string | null;
          sector?: string | null;
          status?: string;
          title?: string;
          updated_at?: string | null;
          valid_until?: string | null;
        };
        Relationships: [];
      };
      porter_forces: {
        Row: {
          analysis_id: string;
          created_at: string | null;
          description: string | null;
          force: string;
          id: string;
          implications: string | null;
          intensity: string | null;
          key_factors: string | null;
          order_index: number | null;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          analysis_id: string;
          created_at?: string | null;
          description?: string | null;
          force: string;
          id?: string;
          implications?: string | null;
          intensity?: string | null;
          key_factors?: string | null;
          order_index?: number | null;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          analysis_id?: string;
          created_at?: string | null;
          description?: string | null;
          force?: string;
          id?: string;
          implications?: string | null;
          intensity?: string | null;
          key_factors?: string | null;
          order_index?: number | null;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'porter_forces_analysis_id_fkey';
            columns: ['analysis_id'];
            isOneToOne: false;
            referencedRelation: 'porter_analyses';
            referencedColumns: ['id'];
          },
        ];
      };
      process_history: {
        Row: {
          action: string;
          after_data: Json;
          before_data: Json | null;
          changed_at: string;
          changed_by: string | null;
          id: string;
          justification: string | null;
          process_id: string;
        };
        Insert: {
          action: string;
          after_data: Json;
          before_data?: Json | null;
          changed_at?: string;
          changed_by?: string | null;
          id?: string;
          justification?: string | null;
          process_id: string;
        };
        Update: {
          action?: string;
          after_data?: Json;
          before_data?: Json | null;
          changed_at?: string;
          changed_by?: string | null;
          id?: string;
          justification?: string | null;
          process_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'process_history_process_id_fkey';
            columns: ['process_id'];
            isOneToOne: false;
            referencedRelation: 'processes';
            referencedColumns: ['id'];
          },
        ];
      };
      processes: {
        Row: {
          category_id: string;
          code: string;
          complexity_score: number;
          created_at: string | null;
          custom_fields: Json;
          description: string;
          id: string;
          impact_score: number;
          maturity_level: number;
          objective: string;
          obsolete: boolean;
          order_index: number;
          owner: string | null;
          owner_id: string | null;
          participant_ids: string[];
          title: string;
          updated_at: string | null;
        };
        Insert: {
          category_id: string;
          code?: string;
          complexity_score?: number;
          created_at?: string | null;
          custom_fields?: Json;
          description?: string;
          id?: string;
          impact_score?: number;
          maturity_level?: number;
          objective?: string;
          obsolete?: boolean;
          order_index?: number;
          owner?: string | null;
          owner_id?: string | null;
          participant_ids?: string[];
          title: string;
          updated_at?: string | null;
        };
        Update: {
          category_id?: string;
          code?: string;
          complexity_score?: number;
          created_at?: string | null;
          custom_fields?: Json;
          description?: string;
          id?: string;
          impact_score?: number;
          maturity_level?: number;
          objective?: string;
          obsolete?: boolean;
          order_index?: number;
          owner?: string | null;
          owner_id?: string | null;
          participant_ids?: string[];
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'processes_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'value_chain_categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'processes_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          category_id: string | null;
          created_at: string | null;
          email: string | null;
          id: string;
          is_active: boolean;
          is_department_head: boolean;
          module_access: string[];
          name: string;
          birth_date: string | null;
          receive_email_alerts: boolean;
          registration_code: string | null;
          role: Database['public']['Enums']['user_role'];
          short_name: string | null;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string | null;
          email?: string | null;
          id: string;
          is_active?: boolean;
          is_department_head?: boolean;
          module_access?: string[];
          name: string;
          birth_date?: string | null;
          receive_email_alerts?: boolean;
          registration_code?: string | null;
          role?: Database['public']['Enums']['user_role'];
          short_name?: string | null;
        };
        Update: {
          category_id?: string | null;
          created_at?: string | null;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          is_department_head?: boolean;
          module_access?: string[];
          name?: string;
          birth_date?: string | null;
          receive_email_alerts?: boolean;
          registration_code?: string | null;
          role?: Database['public']['Enums']['user_role'];
          short_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'value_chain_categories';
            referencedColumns: ['id'];
          },
        ];
      };
      profile_processes: {
        Row: {
          created_at: string;
          process_id: string;
          profile_id: string;
        };
        Insert: {
          created_at?: string;
          process_id: string;
          profile_id: string;
        };
        Update: {
          created_at?: string;
          process_id?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_processes_process_id_fkey';
            columns: ['process_id'];
            isOneToOne: false;
            referencedRelation: 'processes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profile_processes_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      risk_contingency_plan_statuses: {
        Row: {
          created_at: string;
          is_active: boolean;
          is_default: boolean;
          key: string;
          label: string;
          order_index: number;
        };
        Insert: {
          created_at?: string;
          is_active?: boolean;
          is_default?: boolean;
          key: string;
          label: string;
          order_index?: number;
        };
        Update: {
          created_at?: string;
          is_active?: boolean;
          is_default?: boolean;
          key?: string;
          label?: string;
          order_index?: number;
        };
        Relationships: [];
      };
      risk_contingency_plans: {
        Row: {
          created_at: string | null;
          description: string;
          estimated_cost: string | null;
          id: string;
          responsible: string | null;
          risk_id: string;
          status: string;
          trigger: string | null;
        };
        Insert: {
          created_at?: string | null;
          description: string;
          estimated_cost?: string | null;
          id?: string;
          responsible?: string | null;
          risk_id: string;
          status: string;
          trigger?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string;
          estimated_cost?: string | null;
          id?: string;
          responsible?: string | null;
          risk_id?: string;
          status?: string;
          trigger?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'risk_contingency_plans_risk_id_fkey';
            columns: ['risk_id'];
            isOneToOne: false;
            referencedRelation: 'risks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'risk_contingency_plans_status_fkey';
            columns: ['status'];
            isOneToOne: false;
            referencedRelation: 'risk_contingency_plan_statuses';
            referencedColumns: ['key'];
          },
        ];
      };
      risk_factors: {
        Row: {
          category: string | null;
          created_at: string | null;
          description: string;
          id: string;
          risk_id: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string | null;
          description: string;
          id?: string;
          risk_id: string;
        };
        Update: {
          category?: string | null;
          created_at?: string | null;
          description?: string;
          id?: string;
          risk_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'risk_factors_risk_id_fkey';
            columns: ['risk_id'];
            isOneToOne: false;
            referencedRelation: 'risks';
            referencedColumns: ['id'];
          },
        ];
      };
      risk_history: {
        Row: {
          action: string;
          after_data: Json | null;
          before_data: Json | null;
          changed_at: string;
          changed_by: string | null;
          changed_by_name: string | null;
          entity: string;
          entity_id: string;
          id: string;
          justification: string | null;
          risk_id: string;
        };
        Insert: {
          action: string;
          after_data?: Json | null;
          before_data?: Json | null;
          changed_at?: string;
          changed_by?: string | null;
          changed_by_name?: string | null;
          entity: string;
          entity_id: string;
          id?: string;
          justification?: string | null;
          risk_id: string;
        };
        Update: {
          action?: string;
          after_data?: Json | null;
          before_data?: Json | null;
          changed_at?: string;
          changed_by?: string | null;
          changed_by_name?: string | null;
          entity?: string;
          entity_id?: string;
          id?: string;
          justification?: string | null;
          risk_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'risk_history_risk_id_fkey';
            columns: ['risk_id'];
            isOneToOne: false;
            referencedRelation: 'risks';
            referencedColumns: ['id'];
          },
        ];
      };
      risk_matrix_classifications: {
        Row: {
          background_color: string;
          label: string;
          max_score: number;
          min_score: number;
          text_color: string;
        };
        Insert: {
          background_color: string;
          label: string;
          max_score: number;
          min_score: number;
          text_color: string;
        };
        Update: {
          background_color?: string;
          label?: string;
          max_score?: number;
          min_score?: number;
          text_color?: string;
        };
        Relationships: [];
      };
      risk_preventive_action_statuses: {
        Row: {
          created_at: string;
          is_active: boolean;
          is_default: boolean;
          key: string;
          label: string;
          order_index: number;
        };
        Insert: {
          created_at?: string;
          is_active?: boolean;
          is_default?: boolean;
          key: string;
          label: string;
          order_index?: number;
        };
        Update: {
          created_at?: string;
          is_active?: boolean;
          is_default?: boolean;
          key?: string;
          label?: string;
          order_index?: number;
        };
        Relationships: [];
      };
      risk_preventive_actions: {
        Row: {
          created_at: string | null;
          description: string;
          factor_id: string | null;
          id: string;
          responsible: string | null;
          risk_id: string;
          status: string;
        };
        Insert: {
          created_at?: string | null;
          description: string;
          factor_id?: string | null;
          id?: string;
          responsible?: string | null;
          risk_id: string;
          status: string;
        };
        Update: {
          created_at?: string | null;
          description?: string;
          factor_id?: string | null;
          id?: string;
          responsible?: string | null;
          risk_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'risk_preventive_actions_factor_id_fkey';
            columns: ['factor_id'];
            isOneToOne: false;
            referencedRelation: 'risk_factors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'risk_preventive_actions_risk_id_fkey';
            columns: ['risk_id'];
            isOneToOne: false;
            referencedRelation: 'risks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'risk_preventive_actions_status_fkey';
            columns: ['status'];
            isOneToOne: false;
            referencedRelation: 'risk_preventive_action_statuses';
            referencedColumns: ['key'];
          },
        ];
      };
      risk_statuses: {
        Row: {
          created_at: string;
          is_active: boolean;
          is_default: boolean;
          is_treated: boolean;
          key: string;
          label: string;
          order_index: number;
        };
        Insert: {
          created_at?: string;
          is_active?: boolean;
          is_default?: boolean;
          is_treated?: boolean;
          key: string;
          label: string;
          order_index?: number;
        };
        Update: {
          created_at?: string;
          is_active?: boolean;
          is_default?: boolean;
          is_treated?: boolean;
          key?: string;
          label?: string;
          order_index?: number;
        };
        Relationships: [];
      };
      risk_types: {
        Row: {
          created_at: string;
          is_active: boolean;
          is_default: boolean;
          key: string;
          label: string;
          order_index: number;
        };
        Insert: {
          created_at?: string;
          is_active?: boolean;
          is_default?: boolean;
          key: string;
          label: string;
          order_index?: number;
        };
        Update: {
          created_at?: string;
          is_active?: boolean;
          is_default?: boolean;
          key?: string;
          label?: string;
          order_index?: number;
        };
        Relationships: [];
      };
      risks: {
        Row: {
          approval_state: string;
          approved_at: string | null;
          approved_by: string | null;
          barriers: string | null;
          code: string;
          created_at: string | null;
          custom_fields: Json;
          description: string | null;
          id: string;
          impact: number;
          is_active: boolean;
          owner: string | null;
          owner_id: string | null;
          probability: number;
          process_id: string;
          rejection_reason: string | null;
          risk_level: string;
          risk_score: number | null;
          risk_type: string;
          status: string;
          step_id: string | null;
          submitted_at: string | null;
          submitted_by: string | null;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          approval_state?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          barriers?: string | null;
          code?: string;
          created_at?: string | null;
          custom_fields?: Json;
          description?: string | null;
          id?: string;
          impact?: number;
          is_active?: boolean;
          owner?: string | null;
          owner_id?: string | null;
          probability?: number;
          process_id: string;
          rejection_reason?: string | null;
          risk_level: string;
          risk_score?: number | null;
          risk_type: string;
          status: string;
          step_id?: string | null;
          submitted_at?: string | null;
          submitted_by?: string | null;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          approval_state?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          barriers?: string | null;
          code?: string;
          created_at?: string | null;
          custom_fields?: Json;
          description?: string | null;
          id?: string;
          impact?: number;
          is_active?: boolean;
          owner?: string | null;
          owner_id?: string | null;
          probability?: number;
          process_id?: string;
          rejection_reason?: string | null;
          risk_level?: string;
          risk_score?: number | null;
          risk_type?: string;
          status?: string;
          step_id?: string | null;
          submitted_at?: string | null;
          submitted_by?: string | null;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'risks_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'risks_process_id_fkey';
            columns: ['process_id'];
            isOneToOne: false;
            referencedRelation: 'processes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'risks_risk_type_fkey';
            columns: ['risk_type'];
            isOneToOne: false;
            referencedRelation: 'risk_types';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'risks_status_fkey';
            columns: ['status'];
            isOneToOne: false;
            referencedRelation: 'risk_statuses';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'risks_step_id_fkey';
            columns: ['step_id'];
            isOneToOne: false;
            referencedRelation: 'sipoc_nodes';
            referencedColumns: ['id'];
          },
        ];
      };
      sipoc_node_associations: {
        Row: {
          created_at: string | null;
          id: string;
          node_id: string;
          process_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          node_id: string;
          process_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          node_id?: string;
          process_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sipoc_node_associations_node_id_fkey';
            columns: ['node_id'];
            isOneToOne: false;
            referencedRelation: 'sipoc_nodes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sipoc_node_associations_process_id_fkey';
            columns: ['process_id'];
            isOneToOne: false;
            referencedRelation: 'processes';
            referencedColumns: ['id'];
          },
        ];
      };
      sipoc_nodes: {
        Row: {
          created_at: string | null;
          custom_fields: Json;
          description: string | null;
          id: string;
          node_type: string;
          order_index: number;
          process_id: string | null;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          custom_fields?: Json;
          description?: string | null;
          id?: string;
          node_type: string;
          order_index?: number;
          process_id?: string | null;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          custom_fields?: Json;
          description?: string | null;
          id?: string;
          node_type?: string;
          order_index?: number;
          process_id?: string | null;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'sipoc_nodes_process_id_fkey';
            columns: ['process_id'];
            isOneToOne: false;
            referencedRelation: 'processes';
            referencedColumns: ['id'];
          },
        ];
      };
      sipoc_step_associations: {
        Row: {
          associated_node_id: string;
          created_at: string | null;
          id: string;
          step_node_id: string;
        };
        Insert: {
          associated_node_id: string;
          created_at?: string | null;
          id?: string;
          step_node_id: string;
        };
        Update: {
          associated_node_id?: string;
          created_at?: string | null;
          id?: string;
          step_node_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sipoc_step_associations_associated_node_id_fkey';
            columns: ['associated_node_id'];
            isOneToOne: false;
            referencedRelation: 'sipoc_nodes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sipoc_step_associations_step_node_id_fkey';
            columns: ['step_node_id'];
            isOneToOne: false;
            referencedRelation: 'sipoc_nodes';
            referencedColumns: ['id'];
          },
        ];
      };
      sla_approvals: {
        Row: {
          approver_id: string | null;
          decided_at: string | null;
          decision: string;
          id: string;
          process_ids: string[];
          reason: string | null;
          requested_at: string;
          revision: number;
          sla_id: string;
        };
        Insert: {
          approver_id?: string | null;
          decided_at?: string | null;
          decision?: string;
          id?: string;
          process_ids: string[];
          reason?: string | null;
          requested_at?: string;
          revision: number;
          sla_id: string;
        };
        Update: {
          approver_id?: string | null;
          decided_at?: string | null;
          decision?: string;
          id?: string;
          process_ids?: string[];
          reason?: string | null;
          requested_at?: string;
          revision?: number;
          sla_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sla_approvals_sla_id_fkey';
            columns: ['sla_id'];
            isOneToOne: false;
            referencedRelation: 'slas';
            referencedColumns: ['id'];
          },
        ];
      };
      sla_history: {
        Row: {
          action: string;
          after_data: Json;
          before_data: Json | null;
          changed_at: string;
          changed_by: string | null;
          id: string;
          justification: string | null;
          sla_id: string;
        };
        Insert: {
          action: string;
          after_data: Json;
          before_data?: Json | null;
          changed_at?: string;
          changed_by?: string | null;
          id?: string;
          justification?: string | null;
          sla_id: string;
        };
        Update: {
          action?: string;
          after_data?: Json;
          before_data?: Json | null;
          changed_at?: string;
          changed_by?: string | null;
          id?: string;
          justification?: string | null;
          sla_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sla_history_sla_id_fkey';
            columns: ['sla_id'];
            isOneToOne: false;
            referencedRelation: 'slas';
            referencedColumns: ['id'];
          },
        ];
      };
      sla_statuses: {
        Row: {
          badge_background: string;
          badge_foreground: string;
          created_at: string;
          is_active: boolean;
          is_default: boolean;
          key: string;
          label: string;
          order_index: number;
        };
        Insert: {
          badge_background?: string;
          badge_foreground?: string;
          created_at?: string;
          is_active?: boolean;
          is_default?: boolean;
          key: string;
          label: string;
          order_index?: number;
        };
        Update: {
          badge_background?: string;
          badge_foreground?: string;
          created_at?: string;
          is_active?: boolean;
          is_default?: boolean;
          key?: string;
          label?: string;
          order_index?: number;
        };
        Relationships: [];
      };
      slas: {
        Row: {
          approval_revision: number;
          approval_state: string;
          approved_at: string | null;
          business_rules: string | null;
          client_process_id: string | null;
          code: string | null;
          created_at: string | null;
          criticality: Database['public']['Enums']['sla_criticality_level'] | null;
          custom_fields: Json | null;
          description: string | null;
          id: string;
          lead_time_hours: number;
          quality_criteria: string | null;
          sipoc_input_id: string | null;
          status: string;
          submitted_at: string | null;
          supplier_process_id: string | null;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          approval_revision?: number;
          approval_state?: string;
          approved_at?: string | null;
          business_rules?: string | null;
          client_process_id?: string | null;
          code?: string | null;
          created_at?: string | null;
          criticality?: Database['public']['Enums']['sla_criticality_level'] | null;
          custom_fields?: Json | null;
          description?: string | null;
          id?: string;
          lead_time_hours?: number;
          quality_criteria?: string | null;
          sipoc_input_id?: string | null;
          status: string;
          submitted_at?: string | null;
          supplier_process_id?: string | null;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          approval_revision?: number;
          approval_state?: string;
          approved_at?: string | null;
          business_rules?: string | null;
          client_process_id?: string | null;
          code?: string | null;
          created_at?: string | null;
          criticality?: Database['public']['Enums']['sla_criticality_level'] | null;
          custom_fields?: Json | null;
          description?: string | null;
          id?: string;
          lead_time_hours?: number;
          quality_criteria?: string | null;
          sipoc_input_id?: string | null;
          status?: string;
          submitted_at?: string | null;
          supplier_process_id?: string | null;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'slas_client_process_id_fkey';
            columns: ['client_process_id'];
            isOneToOne: false;
            referencedRelation: 'processes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'slas_sipoc_input_id_fkey';
            columns: ['sipoc_input_id'];
            isOneToOne: false;
            referencedRelation: 'sipoc_nodes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'slas_status_fkey';
            columns: ['status'];
            isOneToOne: false;
            referencedRelation: 'sla_statuses';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'slas_supplier_process_id_fkey';
            columns: ['supplier_process_id'];
            isOneToOne: false;
            referencedRelation: 'processes';
            referencedColumns: ['id'];
          },
        ];
      };
      strategic_identity: {
        Row: {
          created_at: string | null;
          id: string;
          mission: string | null;
          period: string | null;
          purpose: string | null;
          updated_at: string | null;
          values: string | null;
          vision: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          mission?: string | null;
          period?: string | null;
          purpose?: string | null;
          updated_at?: string | null;
          values?: string | null;
          vision?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          mission?: string | null;
          period?: string | null;
          purpose?: string | null;
          updated_at?: string | null;
          values?: string | null;
          vision?: string | null;
        };
        Relationships: [];
      };
      swot_analyses: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          order_index: number | null;
          period: string | null;
          status: string;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          order_index?: number | null;
          period?: string | null;
          status?: string;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          order_index?: number | null;
          period?: string | null;
          status?: string;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      swot_items: {
        Row: {
          analysis_id: string;
          created_at: string | null;
          description: string | null;
          id: string;
          order_index: number | null;
          quadrant: string;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          analysis_id: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          order_index?: number | null;
          quadrant: string;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          analysis_id?: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          order_index?: number | null;
          quadrant?: string;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'swot_items_analysis_id_fkey';
            columns: ['analysis_id'];
            isOneToOne: false;
            referencedRelation: 'swot_analyses';
            referencedColumns: ['id'];
          },
        ];
      };
      ticket_statuses: {
        Row: {
          created_at: string;
          header_background: string;
          header_border: string;
          header_foreground: string;
          is_active: boolean;
          is_initial: boolean;
          is_terminal: boolean;
          key: string;
          label: string;
          next_status_key: string | null;
          order_index: number;
        };
        Insert: {
          created_at?: string;
          header_background?: string;
          header_border?: string;
          header_foreground?: string;
          is_active?: boolean;
          is_initial?: boolean;
          is_terminal?: boolean;
          key: string;
          label: string;
          next_status_key?: string | null;
          order_index?: number;
        };
        Update: {
          created_at?: string;
          header_background?: string;
          header_border?: string;
          header_foreground?: string;
          is_active?: boolean;
          is_initial?: boolean;
          is_terminal?: boolean;
          key?: string;
          label?: string;
          next_status_key?: string | null;
          order_index?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'ticket_statuses_next_status_key_fkey';
            columns: ['next_status_key'];
            isOneToOne: false;
            referencedRelation: 'ticket_statuses';
            referencedColumns: ['key'];
          },
        ];
      };
      tickets: {
        Row: {
          analysis_completed: boolean;
          classification_flag: string | null;
          code: string;
          created_at: string | null;
          created_by: string | null;
          custom_fields: Json;
          description: string | null;
          free_description: string | null;
          id: string;
          incident_datetime: string | null;
          incident_type: string | null;
          notification_type_id: string | null;
          process_id: string;
          risk_id: string | null;
          severity: string;
          sla_id: string | null;
          status: string;
          step_id: string | null;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          analysis_completed?: boolean;
          classification_flag?: string | null;
          code?: string;
          created_at?: string | null;
          created_by?: string | null;
          custom_fields?: Json;
          description?: string | null;
          free_description?: string | null;
          id?: string;
          incident_datetime?: string | null;
          incident_type?: string | null;
          notification_type_id?: string | null;
          process_id: string;
          risk_id?: string | null;
          severity?: string;
          sla_id?: string | null;
          status: string;
          step_id?: string | null;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          analysis_completed?: boolean;
          classification_flag?: string | null;
          code?: string;
          created_at?: string | null;
          created_by?: string | null;
          custom_fields?: Json;
          description?: string | null;
          free_description?: string | null;
          id?: string;
          incident_datetime?: string | null;
          incident_type?: string | null;
          notification_type_id?: string | null;
          process_id?: string;
          risk_id?: string | null;
          severity?: string;
          sla_id?: string | null;
          status?: string;
          step_id?: string | null;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tickets_notification_type_id_fkey';
            columns: ['notification_type_id'];
            isOneToOne: false;
            referencedRelation: 'notification_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tickets_process_id_fkey';
            columns: ['process_id'];
            isOneToOne: false;
            referencedRelation: 'processes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tickets_risk_id_fkey';
            columns: ['risk_id'];
            isOneToOne: false;
            referencedRelation: 'risks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tickets_severity_fkey';
            columns: ['severity'];
            isOneToOne: false;
            referencedRelation: 'notification_severities';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'tickets_sla_id_fkey';
            columns: ['sla_id'];
            isOneToOne: false;
            referencedRelation: 'slas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tickets_status_fkey';
            columns: ['status'];
            isOneToOne: false;
            referencedRelation: 'ticket_statuses';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'tickets_step_id_fkey';
            columns: ['step_id'];
            isOneToOne: false;
            referencedRelation: 'sipoc_nodes';
            referencedColumns: ['id'];
          },
        ];
      };
      value_chain_categories: {
        Row: {
          color_key: string;
          created_at: string | null;
          description: string | null;
          id: string;
          name: string;
          order_index: number;
        };
        Insert: {
          color_key?: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          order_index?: number;
        };
        Update: {
          color_key?: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          order_index?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      activate_sla: {
        Args: { p_id: string };
        Returns: {
          approval_revision: number;
          approval_state: string;
          approved_at: string | null;
          business_rules: string | null;
          client_process_id: string | null;
          code: string | null;
          created_at: string | null;
          criticality: Database['public']['Enums']['sla_criticality_level'] | null;
          custom_fields: Json | null;
          description: string | null;
          id: string;
          lead_time_hours: number;
          quality_criteria: string | null;
          sipoc_input_id: string | null;
          status: string;
          submitted_at: string | null;
          supplier_process_id: string | null;
          title: string;
          updated_at: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'slas';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      advance_document: {
        Args: {
          p_document_id: string;
          p_expected_status: Database['public']['Enums']['document_status'];
          p_next_status: Database['public']['Enums']['document_status'];
        };
        Returns: {
          code: string | null;
          created_at: string | null;
          drive_link: string | null;
          id: string;
          owner_id: string | null;
          print_allowed: boolean;
          process_id: string | null;
          status: Database['public']['Enums']['document_status'];
          title: string;
          type_id: string | null;
          updated_at: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'documents';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      calculate_composite_indicator: {
        Args: { p_indicator_id: string; p_period: string };
        Returns: number;
      };
      consume_ai_quota: { Args: never; Returns: boolean };
      create_action_plans_from_suggestions: {
        Args: { p_suggestions: Json; p_ticket_id: string };
        Returns: {
          code: string;
          created_at: string | null;
          how: string | null;
          how_much: string | null;
          id: string;
          status: string;
          ticket_id: string;
          title: string;
          updated_at: string | null;
          what: string | null;
          when: string | null;
          where: string | null;
          who: string | null;
          why: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'action_plans';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      create_dimension_version: {
        Args: { p_label: string };
        Returns: {
          created_at: string;
          created_by: string | null;
          id: string;
          label: string;
          version_number: number;
        };
        SetofOptions: {
          from: '*';
          to: 'dimension_versions';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_plans_for_indicator_analysis: {
        Args: { p_analysis_id: string; p_ticket_id: string };
        Returns: {
          code: string;
          created_at: string | null;
          how: string | null;
          how_much: string | null;
          id: string;
          status: string;
          ticket_id: string;
          title: string;
          updated_at: string | null;
          what: string | null;
          when: string | null;
          where: string | null;
          who: string | null;
          why: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'action_plans';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      create_sipoc_node_with_steps: {
        Args: {
          p_description: string;
          p_node_type: string;
          p_process_id: string;
          p_step_ids: string[];
          p_title: string;
        };
        Returns: {
          created_at: string | null;
          custom_fields: Json;
          description: string | null;
          id: string;
          node_type: string;
          order_index: number;
          process_id: string | null;
          title: string;
          updated_at: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'sipoc_nodes';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_sla_draft: {
        Args: { p_payload: Json };
        Returns: {
          approval_revision: number;
          approval_state: string;
          approved_at: string | null;
          business_rules: string | null;
          client_process_id: string | null;
          code: string | null;
          created_at: string | null;
          criticality: Database['public']['Enums']['sla_criticality_level'] | null;
          custom_fields: Json | null;
          description: string | null;
          id: string;
          lead_time_hours: number;
          quality_criteria: string | null;
          sipoc_input_id: string | null;
          status: string;
          submitted_at: string | null;
          supplier_process_id: string | null;
          title: string;
          updated_at: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'slas';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      deactivate_sla: {
        Args: { p_id: string; p_reason: string };
        Returns: {
          approval_revision: number;
          approval_state: string;
          approved_at: string | null;
          business_rules: string | null;
          client_process_id: string | null;
          code: string | null;
          created_at: string | null;
          criticality: Database['public']['Enums']['sla_criticality_level'] | null;
          custom_fields: Json | null;
          description: string | null;
          id: string;
          lead_time_hours: number;
          quality_criteria: string | null;
          sipoc_input_id: string | null;
          status: string;
          submitted_at: string | null;
          supplier_process_id: string | null;
          title: string;
          updated_at: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'slas';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      decide_sla_approval: {
        Args: { p_approve: boolean; p_id: string; p_reason: string };
        Returns: {
          approval_revision: number;
          approval_state: string;
          approved_at: string | null;
          business_rules: string | null;
          client_process_id: string | null;
          code: string | null;
          created_at: string | null;
          criticality: Database['public']['Enums']['sla_criticality_level'] | null;
          custom_fields: Json | null;
          description: string | null;
          id: string;
          lead_time_hours: number;
          quality_criteria: string | null;
          sipoc_input_id: string | null;
          status: string;
          submitted_at: string | null;
          supplier_process_id: string | null;
          title: string;
          updated_at: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'slas';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_indicator_frequency_options: {
        Args: never;
        Returns: {
          label: string;
          value: string;
        }[];
      };
      get_indicator_unit_options: {
        Args: never;
        Returns: {
          label: string;
          value: string;
        }[];
      };
      get_user_category_id: { Args: never; Returns: string };
      get_user_role: {
        Args: never;
        Returns: Database['public']['Enums']['user_role'];
      };
      indicator_result_actors: {
        Args: never;
        Returns: {
          id: string;
          name: string;
        }[];
      };
      is_admin_or_gestor: { Args: never; Returns: boolean };
      record_indicator_result: {
        Args: {
          p_analysis?: string;
          p_indicator_id: string;
          p_late_justification?: string;
          p_period: string;
          p_value: number;
        };
        Returns: Json;
      };
      record_indicator_value: {
        Args: { p_indicator_id: string; p_period: string; p_value: number };
        Returns: {
          acceptable_variation: number;
          calculation_type: string;
          code: string;
          created_at: string | null;
          current_value: number;
          decimal_places: number;
          dimension_id: string | null;
          formula_expression: string;
          formula_tokens: Json;
          frequency: Database['public']['Enums']['indicator_frequency_type'] | null;
          goal_direction: string;
          goal_value: number;
          id: string;
          indicator_type: string;
          objective: string;
          obsolete: boolean;
          process_id: string;
          requires_critical_analysis: boolean;
          result_source: string;
          simple_formula: string;
          status: string;
          step_id: string | null;
          strategic: boolean;
          title: string;
          unit: Database['public']['Enums']['indicator_unit_type'];
          updated_at: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'indicators';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      refresh_composite_indicator: {
        Args: { p_indicator_id: string; p_period: string };
        Returns: undefined;
      };
      save_dimension_with_links: {
        Args: {
          p_classification_key: string;
          p_color_key: string;
          p_description: string;
          p_id: string;
          p_indicator_ids: string[];
          p_name: string;
          p_objective: string;
          p_order_index: number;
          p_plan_ids: string[];
          p_version_id: string;
        };
        Returns: {
          classification: Database['public']['Enums']['dimension_classification_type'] | null;
          classification_key: string;
          code: string;
          color_key: string;
          created_at: string | null;
          custom_fields: Json | null;
          description: string | null;
          id: string;
          name: string;
          objective: string | null;
          order_index: number | null;
          updated_at: string | null;
          version_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'dimensions';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_document: {
        Args: {
          p_document_id: string;
          p_drive_link: string;
          p_expected_status: Database['public']['Enums']['document_status'];
          p_print_allowed: boolean;
          p_process_id: string;
          p_status: Database['public']['Enums']['document_status'];
          p_title: string;
          p_type_id: string;
        };
        Returns: {
          code: string | null;
          created_at: string | null;
          drive_link: string | null;
          id: string;
          owner_id: string | null;
          print_allowed: boolean;
          process_id: string | null;
          status: Database['public']['Enums']['document_status'];
          title: string;
          type_id: string | null;
          updated_at: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'documents';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_indicator_definition: {
        Args: {
          p_acceptable_variation: number;
          p_calculation_type: string;
          p_decimal_places: number;
          p_dimension_id: string;
          p_formula_expression: string;
          p_formula_tokens: Json;
          p_frequency: Database['public']['Enums']['indicator_frequency_type'];
          p_goal_direction: string;
          p_goal_value: number;
          p_id: string;
          p_indicator_type: string;
          p_justification: string;
          p_objective: string;
          p_obsolete: boolean;
          p_process_id: string;
          p_requires_critical_analysis: boolean;
          p_result_source: string;
          p_simple_formula: string;
          p_step_id: string;
          p_strategic: boolean;
          p_title: string;
          p_unit: Database['public']['Enums']['indicator_unit_type'];
        };
        Returns: {
          acceptable_variation: number;
          calculation_type: string;
          code: string;
          created_at: string | null;
          current_value: number;
          decimal_places: number;
          dimension_id: string | null;
          formula_expression: string;
          formula_tokens: Json;
          frequency: Database['public']['Enums']['indicator_frequency_type'] | null;
          goal_direction: string;
          goal_value: number;
          id: string;
          indicator_type: string;
          objective: string;
          obsolete: boolean;
          process_id: string;
          requires_critical_analysis: boolean;
          result_source: string;
          simple_formula: string;
          status: string;
          step_id: string | null;
          strategic: boolean;
          title: string;
          unit: Database['public']['Enums']['indicator_unit_type'];
          updated_at: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'indicators';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_risk_matrix_classifications: {
        Args: { p_items: Json };
        Returns: {
          background_color: string;
          label: string;
          max_score: number;
          min_score: number;
          text_color: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'risk_matrix_classifications';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      submit_sla_for_approval: {
        Args: { p_id: string };
        Returns: {
          approval_revision: number;
          approval_state: string;
          approved_at: string | null;
          business_rules: string | null;
          client_process_id: string | null;
          code: string | null;
          created_at: string | null;
          criticality: Database['public']['Enums']['sla_criticality_level'] | null;
          custom_fields: Json | null;
          description: string | null;
          id: string;
          lead_time_hours: number;
          quality_criteria: string | null;
          sipoc_input_id: string | null;
          status: string;
          submitted_at: string | null;
          supplier_process_id: string | null;
          title: string;
          updated_at: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'slas';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_process_with_reason: {
        Args: { p_id: string; p_justification: string; p_patch: Json };
        Returns: {
          category_id: string;
          code: string;
          complexity_score: number;
          created_at: string | null;
          custom_fields: Json;
          description: string;
          id: string;
          impact_score: number;
          maturity_level: number;
          objective: string;
          obsolete: boolean;
          order_index: number;
          owner: string | null;
          owner_id: string | null;
          participant_ids: string[];
          title: string;
          updated_at: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'processes';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_risk_with_reason: {
        Args: { p_id: string; p_justification: string; p_patch: Json };
        Returns: {
          approval_state: string;
          approved_at: string | null;
          approved_by: string | null;
          barriers: string | null;
          code: string;
          created_at: string | null;
          custom_fields: Json;
          description: string | null;
          id: string;
          impact: number;
          is_active: boolean;
          owner: string | null;
          owner_id: string | null;
          probability: number;
          process_id: string;
          rejection_reason: string | null;
          risk_level: string;
          risk_score: number | null;
          risk_type: string;
          status: string;
          step_id: string | null;
          submitted_at: string | null;
          submitted_by: string | null;
          title: string;
          updated_at: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'risks';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_sla_with_reason: {
        Args: { p_id: string; p_justification: string; p_patch: Json };
        Returns: {
          approval_revision: number;
          approval_state: string;
          approved_at: string | null;
          business_rules: string | null;
          client_process_id: string | null;
          code: string | null;
          created_at: string | null;
          criticality: Database['public']['Enums']['sla_criticality_level'] | null;
          custom_fields: Json | null;
          description: string | null;
          id: string;
          lead_time_hours: number;
          quality_criteria: string | null;
          sipoc_input_id: string | null;
          status: string;
          submitted_at: string | null;
          supplier_process_id: string | null;
          title: string;
          updated_at: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'slas';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      copy_status: 'solicitada' | 'entregue' | 'recolhida';
      dimension_classification_type:
        | 'financeira'
        | 'mercado_cliente'
        | 'processos_operacionais'
        | 'pessoas_cultura'
        | 'qualidade_seguranca'
        | 'compliance_regulatorio'
        | 'infraestrutura_tecnologia'
        | 'esg_sustentabilidade'
        | 'inovacao_melhoria'
        | 'estrategica_governanca';
      document_status: 'rascunho' | 'em_revisao' | 'aprovado' | 'publicado' | 'obsoleto';
      indicator_frequency_type:
        | 'diario'
        | 'semanal'
        | 'quinzenal'
        | 'mensal'
        | 'bimestral'
        | 'trimestral'
        | 'semestral'
        | 'anual'
        | 'por_evento';
      indicator_unit_type:
        | 'percentual'
        | 'numero_absoluto'
        | 'taxa_indice'
        | 'tempo_minutos'
        | 'tempo_horas'
        | 'tempo_dias'
        | 'moeda_reais'
        | 'moeda_outras'
        | 'escala_score'
        | 'peso_massa'
        | 'volume_capacidade'
        | 'comprimento_area'
        | 'binario_booleano'
        | 'outro';
      sla_criticality_level: 'baixa' | 'media' | 'alta' | 'critica';
      user_role:
        'admin' | 'gestor' | 'operador' | 'analista' | 'auditor' | 'visualizador' | 'implantacao';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      copy_status: ['solicitada', 'entregue', 'recolhida'],
      dimension_classification_type: [
        'financeira',
        'mercado_cliente',
        'processos_operacionais',
        'pessoas_cultura',
        'qualidade_seguranca',
        'compliance_regulatorio',
        'infraestrutura_tecnologia',
        'esg_sustentabilidade',
        'inovacao_melhoria',
        'estrategica_governanca',
      ],
      document_status: ['rascunho', 'em_revisao', 'aprovado', 'publicado', 'obsoleto'],
      indicator_frequency_type: [
        'diario',
        'semanal',
        'quinzenal',
        'mensal',
        'bimestral',
        'trimestral',
        'semestral',
        'anual',
        'por_evento',
      ],
      indicator_unit_type: [
        'percentual',
        'numero_absoluto',
        'taxa_indice',
        'tempo_minutos',
        'tempo_horas',
        'tempo_dias',
        'moeda_reais',
        'moeda_outras',
        'escala_score',
        'peso_massa',
        'volume_capacidade',
        'comprimento_area',
        'binario_booleano',
        'outro',
      ],
      sla_criticality_level: ['baixa', 'media', 'alta', 'critica'],
      user_role: [
        'admin',
        'gestor',
        'operador',
        'analista',
        'auditor',
        'visualizador',
        'implantacao',
      ],
    },
  },
} as const;
