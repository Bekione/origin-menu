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
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          name_am: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          name_am?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          name_am?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      waiter_calls: {
        Row: {
          id: string
          device_id: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          device_id: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          device_id?: string
          status?: string
          created_at?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          description_am: string | null
          id: string
          image_url: string | null
          is_available: boolean
          is_fasting: boolean
          is_featured: boolean
          is_special: boolean
          is_spicy: boolean
          is_vegetarian: boolean
          name: string
          name_am: string | null
          price: number
          sort_order: number
          updated_at: string
          gallery: Json | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          description_am?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_fasting?: boolean
          is_featured?: boolean
          is_special?: boolean
          is_spicy?: boolean
          is_vegetarian?: boolean
          name: string
          name_am?: string | null
          price?: number
          sort_order?: number
          updated_at?: string
          gallery?: Json | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          description_am?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_fasting?: boolean
          is_featured?: boolean
          is_special?: boolean
          is_spicy?: boolean
          is_vegetarian?: boolean
          name?: string
          name_am?: string | null
          price?: number
          sort_order?: number
          updated_at?: string
          gallery?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'menu_items_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      restaurant_info: {
        Row: {
          address: string | null
          hours: Json | null
          id: string
          instagram_url: string | null
          map_embed_url: string | null
          map_url: string | null
          max_tables: number | null
          name: string
          payment_methods: Json | null
          phone: string | null
          promo_banner_active: boolean | null
          promo_banner_text: string | null
          promo_banner_url: string | null
          service_charge_pct: number | null
          tagline: string | null
          tiktok_url: string | null
          updated_at: string
          wifi_password: string | null
        }
        Insert: {
          address?: string | null
          hours?: Json | null
          id?: string
          instagram_url?: string | null
          map_embed_url?: string | null
          map_url?: string | null
          max_tables?: number | null
          name?: string
          payment_methods?: Json | null
          phone?: string | null
          promo_banner_active?: boolean | null
          promo_banner_text?: string | null
          promo_banner_url?: string | null
          service_charge_pct?: number | null
          tagline?: string | null
          tiktok_url?: string | null
          updated_at?: string
          wifi_password?: string | null
        }
        Update: {
          address?: string | null
          hours?: Json | null
          id?: string
          instagram_url?: string | null
          map_embed_url?: string | null
          map_url?: string | null
          max_tables?: number | null
          name?: string
          payment_methods?: Json | null
          phone?: string | null
          promo_banner_active?: boolean | null
          promo_banner_text?: string | null
          promo_banner_url?: string | null
          service_charge_pct?: number | null
          tagline?: string | null
          tiktok_url?: string | null
          updated_at?: string
          wifi_password?: string | null
        }
        Relationships: []
      }
      restaurant_tables: {
        Row: {
          id: string
          label: string
          token: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          label: string
          token?: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          label?: string
          token?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      table_orders: {
        Row: {
          id: string
          table_id: string
          table_label: string
          items: Json
          note: string | null
          status: string
          device_id: string
          created_at: string
        }
        Insert: {
          id?: string
          table_id: string
          table_label: string
          items: Json
          note?: string | null
          status?: string
          device_id: string
          created_at?: string
        }
        Update: {
          id?: string
          table_id?: string
          table_label?: string
          items?: Json
          note?: string | null
          status?: string
          device_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'table_orders_table_id_fkey'
            columns: ['table_id']
            isOneToOne: false
            referencedRelation: 'restaurant_tables'
            referencedColumns: ['id']
          },
        ]
      }
      qr_scans: {
        Row: {
          id: string
          table_id: string | null
          table_label: string | null
          device_id: string
          scanned_at: string
        }
        Insert: {
          id?: string
          table_id?: string | null
          table_label?: string | null
          device_id: string
          scanned_at?: string
        }
        Update: {
          id?: string
          table_id?: string | null
          table_label?: string | null
          device_id?: string
          scanned_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
