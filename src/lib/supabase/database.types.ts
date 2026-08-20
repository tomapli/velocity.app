export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      authorized_users: {
        Row: {
          created_at: string
          email: string
          id: string
          picture_url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          picture_url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          picture_url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ig_posts: {
        Row: {
          carousel_image_urls: string[] | null
          comment_count: number | null
          created_at: string
          description: string | null
          first_frame_url: string | null
          id: string
          ig_scrape_id: string
          like_count: number | null
          media_type: Database["public"]["Enums"]["ig_post_media_type"]
          post_url: string
          save_count: number | null
          share_count: number | null
          thumbnail_url: string | null
          uploaded_at: string
          video_embed_url: string | null
          video_length_secs: number | null
          view_count: number | null
        }
        Insert: {
          carousel_image_urls?: string[] | null
          comment_count?: number | null
          created_at?: string
          description?: string | null
          first_frame_url?: string | null
          id?: string
          ig_scrape_id: string
          like_count?: number | null
          media_type: Database["public"]["Enums"]["ig_post_media_type"]
          post_url: string
          save_count?: number | null
          share_count?: number | null
          thumbnail_url?: string | null
          uploaded_at: string
          video_embed_url?: string | null
          video_length_secs?: number | null
          view_count?: number | null
        }
        Update: {
          carousel_image_urls?: string[] | null
          comment_count?: number | null
          created_at?: string
          description?: string | null
          first_frame_url?: string | null
          id?: string
          ig_scrape_id?: string
          like_count?: number | null
          media_type?: Database["public"]["Enums"]["ig_post_media_type"]
          post_url?: string
          save_count?: number | null
          share_count?: number | null
          thumbnail_url?: string | null
          uploaded_at?: string
          video_embed_url?: string | null
          video_length_secs?: number | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ig_posts_ig_scrape_id_fkey"
            columns: ["ig_scrape_id"]
            isOneToOne: false
            referencedRelation: "ig_scrapes"
            referencedColumns: ["id"]
          },
        ]
      }
      ig_scrapes: {
        Row: {
          created_at: string
          description: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          ig_name: string | null
          ig_username: string | null
          indexing_started_at: string | null
          note: string | null
          post_count: number | null
          profile_picture_url: string | null
          since_when: string | null
          source_url: string
          started_by: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          ig_name?: string | null
          ig_username?: string | null
          indexing_started_at?: string | null
          note?: string | null
          post_count?: number | null
          profile_picture_url?: string | null
          since_when?: string | null
          source_url: string
          started_by: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          ig_name?: string | null
          ig_username?: string | null
          indexing_started_at?: string | null
          note?: string | null
          post_count?: number | null
          profile_picture_url?: string | null
          since_when?: string | null
          source_url?: string
          started_by?: string
          updated_at?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          created_at: string
          created_by: string
          id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      before_user_created_hook: { Args: { event: Json }; Returns: Json }
      extract_auth_user_picture: { Args: { meta: Json }; Returns: string }
    }
    Enums: {
      ig_post_media_type: "carousel" | "short" | "static"
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
      ig_post_media_type: ["carousel", "short", "static"],
    },
  },
} as const

