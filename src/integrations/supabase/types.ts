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
      challenge_participants: {
        Row: {
          challenge_id: string
          id: string
          joined_at: string
          progress: Json
          status: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          id?: string
          joined_at?: string
          progress?: Json
          status?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          id?: string
          joined_at?: string
          progress?: Json
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string
          created_by: string
          description: string
          difficulty: string
          end_date: string | null
          id: string
          max_participants: number | null
          skills: string[]
          start_date: string | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          difficulty?: string
          end_date?: string | null
          id?: string
          max_participants?: number | null
          skills?: string[]
          start_date?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          difficulty?: string
          end_date?: string | null
          id?: string
          max_participants?: number | null
          skills?: string[]
          start_date?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_created_by_fkey"
            columns: ["created_by"]
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
      community_space_members: {
        Row: {
          joined_at: string
          role: Database["public"]["Enums"]["space_member_role"]
          space_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role?: Database["public"]["Enums"]["space_member_role"]
          space_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          role?: Database["public"]["Enums"]["space_member_role"]
          space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_space_members_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "community_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_space_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_spaces: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          description?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_spaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      contribution_log: {
        Row: {
          action: string
          category: string
          created_at: string
          id: string
          metadata: Json
          points: number
          profile_id: string
        }
        Insert: {
          action: string
          category: string
          created_at?: string
          id?: string
          metadata?: Json
          points?: number
          profile_id: string
        }
        Update: {
          action?: string
          category?: string
          created_at?: string
          id?: string
          metadata?: Json
          points?: number
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contribution_log_profile_id_fkey"
            columns: ["profile_id"]
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
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      library_collections: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_collections_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "library_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_collections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      library_item_tags: {
        Row: {
          item_id: string
          tag_id: string
        }
        Insert: {
          item_id: string
          tag_id: string
        }
        Update: {
          item_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_item_tags_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "library_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_item_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "library_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      library_items: {
        Row: {
          collection_id: string | null
          content: string
          created_at: string
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          is_favorite: boolean
          is_pinned: boolean
          reading_progress: number
          thumbnail_url: string | null
          title: string
          type: Database["public"]["Enums"]["library_item_type"]
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          collection_id?: string | null
          content?: string
          created_at?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_favorite?: boolean
          is_pinned?: boolean
          reading_progress?: number
          thumbnail_url?: string | null
          title?: string
          type?: Database["public"]["Enums"]["library_item_type"]
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          collection_id?: string | null
          content?: string
          created_at?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_favorite?: boolean
          is_pinned?: boolean
          reading_progress?: number
          thumbnail_url?: string | null
          title?: string
          type?: Database["public"]["Enums"]["library_item_type"]
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "library_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      library_tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      library_versions: {
        Row: {
          content: string
          created_at: string
          editor_id: string
          id: string
          item_id: string
          title: string
        }
        Insert: {
          content?: string
          created_at?: string
          editor_id: string
          id?: string
          item_id: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          editor_id?: string
          id?: string
          item_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_versions_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_versions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "library_items"
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
      notifications: {
        Row: {
          actor_id: string | null
          archived_at: string | null
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          archived_at?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          archived_at?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      post_space_shares: {
        Row: {
          created_at: string
          id: string
          post_id: string
          shared_by: string
          space_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          shared_by: string
          space_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          shared_by?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_space_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_space_shares_shared_by_fkey"
            columns: ["shared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_space_shares_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "community_spaces"
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
          feedback_tags: string[]
          focus: string | null
          help_data: Json | null
          id: string
          images: string[]
          is_pinned: boolean
          progress_data: Json | null
          project_data: Json | null
          project_id: string | null
          project_snapshot: Json | null
          question_data: Json | null
          resource_data: Json | null
          skills: string[]
          space_id: string | null
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
          feedback_tags?: string[]
          focus?: string | null
          help_data?: Json | null
          id?: string
          images?: string[]
          is_pinned?: boolean
          progress_data?: Json | null
          project_data?: Json | null
          project_id?: string | null
          project_snapshot?: Json | null
          question_data?: Json | null
          resource_data?: Json | null
          skills?: string[]
          space_id?: string | null
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
          feedback_tags?: string[]
          focus?: string | null
          help_data?: Json | null
          id?: string
          images?: string[]
          is_pinned?: boolean
          progress_data?: Json | null
          project_data?: Json | null
          project_id?: string | null
          project_snapshot?: Json | null
          question_data?: Json | null
          resource_data?: Json | null
          skills?: string[]
          space_id?: string | null
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
          {
            foreignKeyName: "posts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "community_spaces"
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
          experience_level: Database["public"]["Enums"]["skill_experience_level"]
          profile_id: string
          proof_note: string | null
          proof_url: string | null
          skill_id: string
          verification_level: Database["public"]["Enums"]["skill_verification_level"]
        }
        Insert: {
          created_at?: string
          experience_level?: Database["public"]["Enums"]["skill_experience_level"]
          profile_id: string
          proof_note?: string | null
          proof_url?: string | null
          skill_id: string
          verification_level?: Database["public"]["Enums"]["skill_verification_level"]
        }
        Update: {
          created_at?: string
          experience_level?: Database["public"]["Enums"]["skill_experience_level"]
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
          availability:
            | Database["public"]["Enums"]["availability_status"]
            | null
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
          reputation_score: number
          social_links: Json
          software_stack: string[]
          teaching_style: string | null
          timezone: string | null
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          availability?:
            | Database["public"]["Enums"]["availability_status"]
            | null
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
          reputation_score?: number
          social_links?: Json
          software_stack?: string[]
          teaching_style?: string | null
          timezone?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          availability?:
            | Database["public"]["Enums"]["availability_status"]
            | null
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
          reputation_score?: number
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
          contribution_score: number
          joined_at: string
          profile_id: string
          project_id: string
          role: Database["public"]["Enums"]["project_contributor_role"]
          skills_used: string[]
        }
        Insert: {
          contribution_score?: number
          joined_at?: string
          profile_id: string
          project_id: string
          role?: Database["public"]["Enums"]["project_contributor_role"]
          skills_used?: string[]
        }
        Update: {
          contribution_score?: number
          joined_at?: string
          profile_id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_contributor_role"]
          skills_used?: string[]
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
          community_post_id: string | null
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
          community_post_id?: string | null
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
          community_post_id?: string | null
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
            foreignKeyName: "project_discussions_community_post_id_fkey"
            columns: ["community_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
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
      project_role_applications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          profile_id: string
          role_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          profile_id: string
          role_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          profile_id?: string
          role_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_role_applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_role_applications_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "project_open_roles"
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
          stage: Database["public"]["Enums"]["project_stage"]
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
          stage?: Database["public"]["Enums"]["project_stage"]
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
          stage?: Database["public"]["Enums"]["project_stage"]
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
      session_availability: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          profile_id: string
          start_time: string
          status: Database["public"]["Enums"]["availability_day_status"]
          timezone: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          profile_id: string
          start_time: string
          status?: Database["public"]["Enums"]["availability_day_status"]
          timezone?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          profile_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["availability_day_status"]
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_availability_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          session_id: string
          updated_at: string
          version: number
        }
        Insert: {
          content?: string
          created_at?: string
          created_by: string
          id?: string
          session_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          session_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_participants: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          responded_at: string | null
          role: Database["public"]["Enums"]["participant_role"]
          session_id: string
          status: Database["public"]["Enums"]["participant_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          responded_at?: string | null
          role?: Database["public"]["Enums"]["participant_role"]
          session_id: string
          status?: Database["public"]["Enums"]["participant_status"]
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          responded_at?: string | null
          role?: Database["public"]["Enums"]["participant_role"]
          session_id?: string
          status?: Database["public"]["Enums"]["participant_status"]
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_requests: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          message: string | null
          responded_at: string | null
          session_id: string | null
          status: string
          suggested_time: string | null
          to_user_id: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          message?: string | null
          responded_at?: string | null
          session_id?: string | null
          status?: string
          suggested_time?: string | null
          to_user_id: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          message?: string | null
          responded_at?: string | null
          session_id?: string | null
          status?: string
          suggested_time?: string | null
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_requests_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_requests_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_resources: {
        Row: {
          created_at: string
          file_path: string | null
          id: string
          resource_type: string
          session_id: string
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_path?: string | null
          id?: string
          resource_type?: string
          session_id: string
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          file_path?: string | null
          id?: string
          resource_type?: string
          session_id?: string
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_resources_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          community_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          ends_at: string | null
          exchange_id: string | null
          id: string
          is_recurring: boolean
          location: string | null
          meeting_url: string | null
          organizer_id: string
          project_id: string | null
          recurrence_rule: string | null
          session_type: Database["public"]["Enums"]["session_type"]
          skill_id: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["session_status"]
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          community_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          ends_at?: string | null
          exchange_id?: string | null
          id?: string
          is_recurring?: boolean
          location?: string | null
          meeting_url?: string | null
          organizer_id: string
          project_id?: string | null
          recurrence_rule?: string | null
          session_type?: Database["public"]["Enums"]["session_type"]
          skill_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          timezone?: string
          title: string
          updated_at?: string
        }
        Update: {
          community_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          ends_at?: string | null
          exchange_id?: string | null
          id?: string
          is_recurring?: boolean
          location?: string | null
          meeting_url?: string | null
          organizer_id?: string
          project_id?: string | null
          recurrence_rule?: string | null
          session_type?: Database["public"]["Enums"]["session_type"]
          skill_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
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
      user_achievements: {
        Row: {
          achievement: Database["public"]["Enums"]["achievement_type"]
          awarded_at: string
          id: string
          profile_id: string
        }
        Insert: {
          achievement: Database["public"]["Enums"]["achievement_type"]
          awarded_at?: string
          id?: string
          profile_id: string
        }
        Update: {
          achievement?: Database["public"]["Enums"]["achievement_type"]
          awarded_at?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      insert_notification: {
        Args: {
          p_actor_id: string
          p_body?: string
          p_entity_id?: string
          p_entity_type?: string
          p_metadata?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      is_session_member: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      is_space_member: {
        Args: { p_space_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_space_owner_or_moderator: {
        Args: { p_space_id: string; p_user_id?: string }
        Returns: boolean
      }
      log_activity: {
        Args: { _kind: string; _metadata?: Json; _profile_id: string }
        Returns: undefined
      }
      log_contribution: {
        Args: {
          p_action: string
          p_category: string
          p_metadata?: Json
          p_points: number
          p_profile_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      achievement_type:
        | "first_project"
        | "first_milestone"
        | "first_endorsement"
        | "five_endorsements"
        | "ten_endorsements"
        | "community_recognized"
        | "mentor"
        | "collaborator"
        | "prolific_teacher"
        | "project_builder"
        | "community_builder"
        | "reliable_collaborator"
        | "helped_ten_people"
        | "learner_journey"
      availability_day_status: "available" | "unavailable" | "tentative"
      availability_status:
        | "available"
        | "busy"
        | "learning"
        | "looking_for_team"
        | "mentoring"
      connection_status: "pending" | "accepted" | "declined"
      library_item_type: "note" | "document" | "link" | "upload"
      participant_role: "organizer" | "participant" | "mentor"
      participant_status: "invited" | "accepted" | "declined" | "pending"
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
      project_stage: "planning" | "building" | "testing" | "launch" | "growing"
      project_status: "planning" | "active" | "paused" | "completed"
      session_status:
        | "draft"
        | "scheduled"
        | "invitation_sent"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
      session_type:
        | "skill_exchange"
        | "mentoring"
        | "project_meeting"
        | "study_session"
        | "workshop"
        | "general"
      skill_experience_level:
        | "beginner"
        | "intermediate"
        | "advanced"
        | "expert"
      skill_verification_level:
        | "self_declared"
        | "proof_certified"
        | "community_recognized"
      space_member_role: "owner" | "moderator" | "member"
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
      achievement_type: [
        "first_project",
        "first_milestone",
        "first_endorsement",
        "five_endorsements",
        "ten_endorsements",
        "community_recognized",
        "mentor",
        "collaborator",
        "prolific_teacher",
        "project_builder",
        "community_builder",
        "reliable_collaborator",
        "helped_ten_people",
        "learner_journey",
      ],
      availability_day_status: ["available", "unavailable", "tentative"],
      availability_status: [
        "available",
        "busy",
        "learning",
        "looking_for_team",
        "mentoring",
      ],
      connection_status: ["pending", "accepted", "declined"],
      library_item_type: ["note", "document", "link", "upload"],
      participant_role: ["organizer", "participant", "mentor"],
      participant_status: ["invited", "accepted", "declined", "pending"],
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
      project_stage: ["planning", "building", "testing", "launch", "growing"],
      project_status: ["planning", "active", "paused", "completed"],
      session_status: [
        "draft",
        "scheduled",
        "invitation_sent",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
      ],
      session_type: [
        "skill_exchange",
        "mentoring",
        "project_meeting",
        "study_session",
        "workshop",
        "general",
      ],
      skill_experience_level: [
        "beginner",
        "intermediate",
        "advanced",
        "expert",
      ],
      skill_verification_level: [
        "self_declared",
        "proof_certified",
        "community_recognized",
      ],
      space_member_role: ["owner", "moderator", "member"],
    },
  },
} as const
