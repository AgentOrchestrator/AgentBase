export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      active_sessions: {
        Row: {
          created_at: string | null;
          editor_type: string;
          id: string;
          is_active: boolean | null;
          last_activity_at: string;
          project_id: string | null;
          recent_files: Json | null;
          session_metadata: Json | null;
          updated_at: string | null;
          user_id: string;
          workspace_path: string | null;
        };
        Insert: {
          created_at?: string | null;
          editor_type: string;
          id?: string;
          is_active?: boolean | null;
          last_activity_at: string;
          project_id?: string | null;
          recent_files?: Json | null;
          session_metadata?: Json | null;
          updated_at?: string | null;
          user_id: string;
          workspace_path?: string | null;
        };
        Update: {
          created_at?: string | null;
          editor_type?: string;
          id?: string;
          is_active?: boolean | null;
          last_activity_at?: string;
          project_id?: string | null;
          recent_files?: Json | null;
          session_metadata?: Json | null;
          updated_at?: string | null;
          user_id?: string;
          workspace_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'active_sessions_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_histories: {
        Row: {
          account_id: string | null;
          agent_type: string | null;
          ai_keywords_generated_at: string | null;
          ai_keywords_message_count: number | null;
          ai_keywords_topic: string[] | null;
          ai_keywords_type: string[] | null;
          ai_summary: string | null;
          ai_summary_generated_at: string | null;
          ai_summary_message_count: number | null;
          ai_title: string | null;
          ai_title_generated_at: string | null;
          created_at: string | null;
          id: string;
          latest_message_timestamp: string | null;
          messages: Json;
          metadata: Json | null;
          project_id: string | null;
          timestamp: string;
          updated_at: string | null;
        };
        Insert: {
          account_id?: string | null;
          agent_type?: string | null;
          ai_keywords_generated_at?: string | null;
          ai_keywords_message_count?: number | null;
          ai_keywords_topic?: string[] | null;
          ai_keywords_type?: string[] | null;
          ai_summary?: string | null;
          ai_summary_generated_at?: string | null;
          ai_summary_message_count?: number | null;
          ai_title?: string | null;
          ai_title_generated_at?: string | null;
          created_at?: string | null;
          id?: string;
          latest_message_timestamp?: string | null;
          messages?: Json;
          metadata?: Json | null;
          project_id?: string | null;
          timestamp: string;
          updated_at?: string | null;
        };
        Update: {
          account_id?: string | null;
          agent_type?: string | null;
          ai_keywords_generated_at?: string | null;
          ai_keywords_message_count?: number | null;
          ai_keywords_topic?: string[] | null;
          ai_keywords_type?: string[] | null;
          ai_summary?: string | null;
          ai_summary_generated_at?: string | null;
          ai_summary_message_count?: number | null;
          ai_title?: string | null;
          ai_title_generated_at?: string | null;
          created_at?: string | null;
          id?: string;
          latest_message_timestamp?: string | null;
          messages?: Json;
          metadata?: Json | null;
          project_id?: string | null;
          timestamp?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_histories_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      daemon_auth_sessions: {
        Row: {
          access_token: string;
          consumed: boolean | null;
          created_at: string | null;
          device_id: string;
          expires_at: string;
          id: string;
          refresh_token: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          access_token: string;
          consumed?: boolean | null;
          created_at?: string | null;
          device_id: string;
          expires_at: string;
          id?: string;
          refresh_token: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          access_token?: string;
          consumed?: boolean | null;
          created_at?: string | null;
          device_id?: string;
          expires_at?: string;
          id?: string;
          refresh_token?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      llm_api_keys: {
        Row: {
          account_id: string;
          api_key: string;
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          is_default: boolean | null;
          provider: string;
          updated_at: string | null;
        };
        Insert: {
          account_id: string;
          api_key: string;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_default?: boolean | null;
          provider: string;
          updated_at?: string | null;
        };
        Update: {
          account_id?: string;
          api_key?: string;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_default?: boolean | null;
          provider?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      pinned_conversations: {
        Row: {
          conversation_id: string;
          created_at: string | null;
          id: string;
          pinned_at: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          created_at?: string | null;
          id?: string;
          pinned_at?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          created_at?: string | null;
          id?: string;
          pinned_at?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pinned_conversations_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'chat_histories';
            referencedColumns: ['id'];
          },
        ];
      };
      project_organization_shares: {
        Row: {
          created_at: string | null;
          id: string;
          organization_name: string;
          permission_level: string;
          project_id: string;
          shared_by_user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          organization_name: string;
          permission_level?: string;
          project_id: string;
          shared_by_user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          organization_name?: string;
          permission_level?: string;
          project_id?: string;
          shared_by_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_organization_shares_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      project_shares: {
        Row: {
          created_at: string | null;
          id: string;
          permission_level: string;
          project_id: string;
          shared_by_user_id: string;
          shared_with_user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          permission_level?: string;
          project_id: string;
          shared_by_user_id: string;
          shared_with_user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          permission_level?: string;
          project_id?: string;
          shared_by_user_id?: string;
          shared_with_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_shares_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      project_workspace_shares: {
        Row: {
          created_at: string | null;
          id: string;
          permission_level: string;
          project_id: string;
          shared_by_user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          permission_level?: string;
          project_id: string;
          shared_by_user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          permission_level?: string;
          project_id?: string;
          shared_by_user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_workspace_shares_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_workspace_shares_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      projects: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          is_default: boolean;
          name: string;
          project_path: string | null;
          updated_at: string | null;
          user_id: string;
          workspace_metadata: Json | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          name: string;
          project_path?: string | null;
          updated_at?: string | null;
          user_id: string;
          workspace_metadata?: Json | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          project_path?: string | null;
          updated_at?: string | null;
          user_id?: string;
          workspace_metadata?: Json | null;
        };
        Relationships: [];
      };
      session_share_exclusions: {
        Row: {
          created_at: string | null;
          excluded_by_user_id: string;
          id: string;
          project_share_id: string | null;
          project_workspace_share_id: string | null;
          session_id: string;
        };
        Insert: {
          created_at?: string | null;
          excluded_by_user_id: string;
          id?: string;
          project_share_id?: string | null;
          project_workspace_share_id?: string | null;
          session_id: string;
        };
        Update: {
          created_at?: string | null;
          excluded_by_user_id?: string;
          id?: string;
          project_share_id?: string | null;
          project_workspace_share_id?: string | null;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'session_share_exclusions_project_share_id_fkey';
            columns: ['project_share_id'];
            isOneToOne: false;
            referencedRelation: 'project_shares';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'session_share_exclusions_project_workspace_share_id_fkey';
            columns: ['project_workspace_share_id'];
            isOneToOne: false;
            referencedRelation: 'project_workspace_shares';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'session_share_exclusions_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'chat_histories';
            referencedColumns: ['id'];
          },
        ];
      };
      session_shares: {
        Row: {
          created_at: string | null;
          id: string;
          permission_level: string;
          session_id: string;
          shared_by_user_id: string;
          shared_with_user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          permission_level?: string;
          session_id: string;
          shared_by_user_id: string;
          shared_with_user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          permission_level?: string;
          session_id?: string;
          shared_by_user_id?: string;
          shared_with_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'session_shares_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'chat_histories';
            referencedColumns: ['id'];
          },
        ];
      };
      session_workspace_shares: {
        Row: {
          created_at: string | null;
          id: string;
          permission_level: string;
          session_id: string;
          shared_by_user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          permission_level?: string;
          session_id: string;
          shared_by_user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          permission_level?: string;
          session_id?: string;
          shared_by_user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'session_workspace_shares_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'chat_histories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'session_workspace_shares_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      user_canvas_layouts: {
        Row: {
          created_at: string | null;
          id: string;
          node_id: string;
          position_x: number;
          position_y: number;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          node_id: string;
          position_x: number;
          position_y: number;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          node_id?: string;
          position_x?: number;
          position_y?: number;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          ai_model_name: string | null;
          ai_model_provider: string | null;
          ai_summary_enabled: boolean | null;
          ai_title_enabled: boolean | null;
          created_at: string | null;
          id: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          ai_model_name?: string | null;
          ai_model_provider?: string | null;
          ai_summary_enabled?: boolean | null;
          ai_title_enabled?: boolean | null;
          created_at?: string | null;
          id?: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          ai_model_name?: string | null;
          ai_model_provider?: string | null;
          ai_summary_enabled?: boolean | null;
          ai_title_enabled?: boolean | null;
          created_at?: string | null;
          id?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          email: string;
          github_avatar_url: string | null;
          github_username: string | null;
          id: string;
          is_admin: boolean;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email: string;
          github_avatar_url?: string | null;
          github_username?: string | null;
          id: string;
          is_admin?: boolean;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string;
          github_avatar_url?: string | null;
          github_username?: string | null;
          id?: string;
          is_admin?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          created_at: string | null;
          id: string;
          invitation_status: string;
          invited_at: string | null;
          invited_by_user_id: string | null;
          joined_at: string | null;
          role: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          invitation_status?: string;
          invited_at?: string | null;
          invited_by_user_id?: string | null;
          joined_at?: string | null;
          role?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          invitation_status?: string;
          invited_at?: string | null;
          invited_by_user_id?: string | null;
          joined_at?: string | null;
          role?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string | null;
          created_by_user_id: string;
          description: string | null;
          id: string;
          name: string;
          slug: string;
          updated_at: string | null;
          workspace_metadata: Json | null;
        };
        Insert: {
          created_at?: string | null;
          created_by_user_id: string;
          description?: string | null;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string | null;
          workspace_metadata?: Json | null;
        };
        Update: {
          created_at?: string | null;
          created_by_user_id?: string;
          description?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string | null;
          workspace_metadata?: Json | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cleanup_consumed_auth_sessions: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      get_user_workspace_ids: {
        Args: { user_id_param: string };
        Returns: {
          workspace_id: string;
        }[];
      };
      has_workspace_access_to_project: {
        Args: {
          project_id_param: string;
          required_permission?: string;
          user_id_param: string;
        };
        Returns: boolean;
      };
      is_system_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_workspace_admin: {
        Args: { user_id_param: string; workspace_id_param: string };
        Returns: boolean;
      };
      is_workspace_member: {
        Args: { user_id_param: string; workspace_id_param: string };
        Returns: boolean;
      };
      user_can_view_project: {
        Args: { project_id_param: string; user_id_param: string };
        Returns: boolean;
      };
      user_has_project_edit_permission: {
        Args: { project_id_param: string; user_id_param: string };
        Returns: boolean;
      };
      user_has_project_share: {
        Args: { project_id_param: string; user_id_param: string };
        Returns: boolean;
      };
      user_in_workspace: {
        Args: { user_uuid: string; workspace_uuid: string };
        Returns: boolean;
      };
      user_owns_project: {
        Args: { project_id_param: string; user_id_param: string };
        Returns: boolean;
      };
      user_owns_session: {
        Args: { session_uuid: string; user_uuid: string };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
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
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
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
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
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
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
