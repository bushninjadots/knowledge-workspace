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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          metadata: Json
          profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          metadata?: Json
          profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_best_answer: boolean
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_best_answer?: boolean
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_best_answer?: boolean
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          intro_message: string | null
          requester_id: string
          status: Database["public"]["Enums"]["connection_status"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          intro_message?: string | null
          requester_id: string
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          intro_message?: string | null
          requester_id?: string
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_replies: {
        Row: {
          author_id: string
          body: string
          created_at: string
          discussion_id: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          discussion_id: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          discussion_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_replies_discussion_id_fkey"
            columns: ["discussion_id"]
            isOneToOne: false
            referencedRelation: "project_discussions"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          connection_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          connection_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          connection_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
        ]
      }
      post_actions: {
        Row: {
          action: Database["public"]["Enums"]["post_action"]
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["post_action"]
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["post_action"]
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_actions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          achievement_data: Json | null
          author_id: string
          body: string
          collaboration_data: Json | null
          community: string
          created_at: string
          focus: string | null
          help_data: Json | null
          id: string
          images: string[]
          progress_data: Json | null
          project_data: Json | null
          question_data: Json | null
          resource_data: Json | null
          skills: string[]
          title: string
          type: Database["public"]["Enums"]["post_type"]
          updated_at: string
        }
        Insert: {
          achievement_data?: Json | null
          author_id: string
          body?: string
          collaboration_data?: Json | null
          community?: string
          created_at?: string
          focus?: string | null
          help_data?: Json | null
          id?: string
          images?: string[]
          progress_data?: Json | null
          project_data?: Json | null
          question_data?: Json | null
          resource_data?: Json | null
          skills?: string[]
          title: string
          type: Database["public"]["Enums"]["post_type"]
          updated_at?: string
        }
        Update: {
          achievement_data?: Json | null
          author_id?: string
          body?: string
          collaboration_data?: Json | null
          community?: string
          created_at?: string
          focus?: string | null
          help_data?: Json | null
          id?: string
          images?: string[]
          progress_data?: Json | null
          project_data?: Json | null
          question_data?: Json | null
          resource_data?: Json | null
          skills?: string[]
          title?: string
          type?: Database["public"]["Enums"]["post_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_skills_learn: {
        Row: {
          created_at: string
          profile_id: string
          skill_id: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          skill_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_skills_learn_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_skills_learn_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_skills_teach: {
        Row: {
          created_at: string
          profile_id: string
          proof_note: string | null
          proof_url: string | null
          skill_id: string
          verification_level: Database["public"]["Enums"]["skill_verification_level"]
        }
        Insert: {
          created_at?: string
          profile_id: string
          proof_note?: string | null
          proof_url?: string | null
          skill_id: string
          verification_level?: Database["public"]["Enums"]["skill_verification_level"]
        }
        Update: {
          created_at?: string
          profile_id?: string
          proof_note?: string | null
          proof_url?: string | null
          skill_id?: string
          verification_level?: Database["public"]["Enums"]["skill_verification_level"]
        }
        Relationships: [
          {
            foreignKeyName: "profile_skills_teach_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_skills_teach_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_skills_wishlist: {
        Row: {
          created_at: string
          profile_id: string
          skill_id: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          skill_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_skills_wishlist_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_skills_wishlist_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          available_days: string[]
          available_times: string[]
          avatar_url: string | null
          banner_caption: string | null
          banner_url: string | null
          bio: string | null
          category: string | null
          country: string | null
          created_at: string
          creator_title: string | null
          display_name: string | null
          favourite_tools: string[]
          handle: string | null
          id: string
          languages: string[]
          learning_goals: string | null
          portfolio_links: Json
          social_links: Json
          software_stack: string[]
          teaching_style: string | null
          timezone: string | null
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          available_days?: string[]
          available_times?: string[]
          avatar_url?: string | null
          banner_caption?: string | null
          banner_url?: string | null
          bio?: string | null
          category?: string | null
          country?: string | null
          created_at?: string
          creator_title?: string | null
          display_name?: string | null
          favourite_tools?: string[]
          handle?: string | null
          id: string
          languages?: string[]
          learning_goals?: string | null
          portfolio_links?: Json
          social_links?: Json
          software_stack?: string[]
          teaching_style?: string | null
          timezone?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          available_days?: string[]
          available_times?: string[]
          avatar_url?: string | null
          banner_caption?: string | null
          banner_url?: string | null
          bio?: string | null
          category?: string | null
          country?: string | null
          created_at?: string
          creator_title?: string | null
          display_name?: string | null
          favourite_tools?: string[]
          handle?: string | null
          id?: string
          languages?: string[]
          learning_goals?: string | null
          portfolio_links?: Json
          social_links?: Json
          software_stack?: string[]
          teaching_style?: string | null
          timezone?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      project_contributors: {
        Row: {
          joined_at: string
          profile_id: string
          project_id: string
          role: Database["public"]["Enums"]["project_contributor_role"]
        }
        Insert: {
          joined_at?: string
          profile_id: string
          project_id: string
          role?: Database["public"]["Enums"]["project_contributor_role"]
        }
        Update: {
          joined_at?: string
          profile_id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_contributor_role"]
        }
        Relationships: [
          {
            foreignKeyName: "project_contributors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contributors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_discussions: {
        Row: {
          author_id: string
          body: string
          category: string
          created_at: string
          id: string
          is_pinned: boolean
          project_id: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          category?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          project_id: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          project_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_discussions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_discussions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          position: number
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          position?: number
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          position?: number
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_open_roles: {
        Row: {
          created_at: string
          description: string | null
          filled_by: string | null
          id: string
          is_filled: boolean
          project_id: string
          skills: string[]
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          filled_by?: string | null
          id?: string
          is_filled?: boolean
          project_id: string
          skills?: string[]
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          filled_by?: string | null
          id?: string
          is_filled?: boolean
          project_id?: string
          skills?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_open_roles_filled_by_fkey"
            columns: ["filled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_open_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_skills: {
        Row: {
          created_at: string
          project_id: string
          skill_id: string
        }
        Insert: {
          created_at?: string
          project_id: string
          skill_id: string
        }
        Update: {
          created_at?: string
          project_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_skills_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      project_updates: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          project_id: string
          title: string
          week_number: number | null
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          project_id: string
          title: string
          week_number?: number | null
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          project_id?: string
          title?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_updates_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          gallery: Json
          goal: string | null
          id: string
          is_featured: boolean
          links: Json
          looking_for_collaborators: boolean
          looking_for_feedback: boolean
          media: Json
          profile_id: string
          progress_percent: number
          resources: Json
          started_at: string
          status: Database["public"]["Enums"]["project_status"]
          tags: string[]
          title: string
          updated_at: string
          vision: string | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          gallery?: Json
          goal?: string | null
          id?: string
          is_featured?: boolean
          links?: Json
          looking_for_collaborators?: boolean
          looking_for_feedback?: boolean
          media?: Json
          profile_id: string
          progress_percent?: number
          resources?: Json
          started_at?: string
          status?: Database["public"]["Enums"]["project_status"]
          tags?: string[]
          title: string
          updated_at?: string
          vision?: string | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          gallery?: Json
          goal?: string | null
          id?: string
          is_featured?: boolean
          links?: Json
          looking_for_collaborators?: boolean
          looking_for_feedback?: boolean
          media?: Json
          profile_id?: string
          progress_percent?: number
          resources?: Json
          started_at?: string
          status?: Database["public"]["Enums"]["project_status"]
          tags?: string[]
          title?: string
          updated_at?: string
          vision?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_endorsements: {
        Row: {
          created_at: string
          endorsed_by: string
          id: string
          profile_id: string
          skill_id: string
        }
        Insert: {
          created_at?: string
          endorsed_by: string
          id?: string
          profile_id: string
          skill_id: string
        }
        Update: {
          created_at?: string
          endorsed_by?: string
          id?: string
          profile_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_endorsements_endorsed_by_fkey"
            columns: ["endorsed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_endorsements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_endorsements_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      log_activity: {
        Args: { _kind: string; _metadata?: Json; _profile_id: string }
        Returns: undefined
      }
    }
    Enums: {
      connection_status: "pending" | "accepted" | "declined"
      post_action: "like" | "helpful" | "save" | "offer"
      post_type:
        | "showcase"
        | "question"
        | "project_update"
        | "tutorial"
        | "resource"
        | "achievement"
        | "discussion"
        | "help_request"
        | "collaboration_request"
        | "progress_update"
      project_contributor_role: "creator" | "contributor" | "mentor"
      project_status: "planning" | "active" | "paused" | "completed"
      skill_verification_level:
        | "self_declared"
        | "proof_certified"
        | "community_recognized"
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
      connection_status: ["pending", "accepted", "declined"],
      post_action: ["like", "helpful", "save", "offer"],
      post_type: [
        "showcase",
        "question",
        "project_update",
        "tutorial",
        "resource",
        "achievement",
        "discussion",
        "help_request",
        "collaboration_request",
        "progress_update",
      ],
      project_contributor_role: ["creator", "contributor", "mentor"],
      project_status: ["planning", "active", "paused", "completed"],
      skill_verification_level: [
        "self_declared",
        "proof_certified",
        "community_recognized",
      ],
    },
  },
} as const
