import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Tables } from "@/integrations/supabase/types";

export type Category = Tables<"categories">;
export type MenuItem = Tables<"menu_items">;
export type RestaurantInfo = Tables<"restaurant_info">;

export type MenuData = {
  categories: Category[];
  items: MenuItem[];
  info: RestaurantInfo | null;
};

export const getMenuData = createServerFn({ method: "GET" }).handler(
  async (): Promise<MenuData> => {
    const [cats, items, info] = await Promise.all([
      supabaseAdmin.from("categories").select("*").order("sort_order"),
      supabaseAdmin.from("menu_items").select("*").order("sort_order"),
      supabaseAdmin.from("restaurant_info").select("*").limit(1).maybeSingle(),
    ]);
    return {
      categories: cats.data ?? [],
      items: items.data ?? [],
      info: info.data ?? null,
    };
  },
);

const AdminAuth = z.object({ password: z.string().min(1).max(200) });

function checkPassword(p: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("Admin password not configured");
  if (p !== expected) throw new Error("Invalid password");
}

export const verifyAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((d) => AdminAuth.parse(d))
  .handler(async ({ data }) => {
    checkPassword(data.password);
    return { ok: true };
  });

const ItemSchema = z.object({
  password: z.string().min(1),
  id: z.string().uuid().optional(),
  category_id: z.string().uuid().nullable(),
  name: z.string().min(1).max(120),
  name_am: z.string().max(120).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  description_am: z.string().max(500).nullable().optional(),
  price: z.number().min(0).max(1000000),
  image_url: z.string().url().nullable().optional(),
  is_available: z.boolean(),
  is_vegetarian: z.boolean(),
  is_spicy: z.boolean(),
  is_fasting: z.boolean(),
  is_featured: z.boolean(),
  sort_order: z.number().int().min(0).max(10000),
});

export const upsertMenuItem = createServerFn({ method: "POST" })
  .inputValidator((d) => ItemSchema.parse(d))
  .handler(async ({ data }) => {
    checkPassword(data.password);
    const { password, id, ...payload } = data;
    if (id) {
      const { error } = await supabaseAdmin
        .from("menu_items")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("menu_items")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const deleteMenuItem = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    checkPassword(data.password);
    const { error } = await supabaseAdmin.from("menu_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleAvailability = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ password: z.string(), id: z.string().uuid(), is_available: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    checkPassword(data.password);
    const { error } = await supabaseAdmin
      .from("menu_items")
      .update({ is_available: data.is_available })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const CategorySchema = z.object({
  password: z.string(),
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  name_am: z.string().max(80).nullable().optional(),
  sort_order: z.number().int().min(0).max(10000),
});

export const upsertCategory = createServerFn({ method: "POST" })
  .inputValidator((d) => CategorySchema.parse(d))
  .handler(async ({ data }) => {
    checkPassword(data.password);
    const { password, id, ...payload } = data;
    if (id) {
      const { error } = await supabaseAdmin.from("categories").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("categories")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    checkPassword(data.password);
    const { error } = await supabaseAdmin.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderMenuItems = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        password: z.string(),
        updates: z.array(z.object({ id: z.string().uuid(), sort_order: z.number() })),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    checkPassword(data.password);
    for (const { id, sort_order } of data.updates) {
      await supabaseAdmin
        .from("menu_items")
        .update({ sort_order, updated_at: new Date().toISOString() })
        .eq("id", id);
    }
    return { ok: true };
  });

export const reorderCategories = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        password: z.string(),
        updates: z.array(z.object({ id: z.string().uuid(), sort_order: z.number() })),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    checkPassword(data.password);
    for (const { id, sort_order } of data.updates) {
      await supabaseAdmin.from("categories").update({ sort_order }).eq("id", id);
    }
    return { ok: true };
  });

const InfoSchema = z.object({
  password: z.string(),
  name: z.string().min(1).max(120),
  tagline: z.string().max(200).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(60).nullable().optional(),
  instagram_url: z.string().max(200).nullable().optional().or(z.literal("")),
  tiktok_url: z.string().max(200).nullable().optional().or(z.literal("")),
  map_url: z.string().max(500).nullable().optional().or(z.literal("")),
  hours: z.array(z.object({ day: z.string().max(40), hours: z.string().max(80) })).max(14),
});

export const updateRestaurantInfo = createServerFn({ method: "POST" })
  .inputValidator((d) => InfoSchema.parse(d))
  .handler(async ({ data }) => {
    checkPassword(data.password);
    const { password, ...payload } = data;
    const { data: existing } = await supabaseAdmin
      .from("restaurant_info")
      .select("id")
      .limit(1)
      .maybeSingle();
    const cleaned = {
      ...payload,
      instagram_url: payload.instagram_url || null,
      tiktok_url: payload.tiktok_url || null,
      map_url: payload.map_url || null,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      const { error } = await supabaseAdmin
        .from("restaurant_info")
        .update(cleaned)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("restaurant_info").insert(cleaned);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const uploadItemImage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        password: z.string(),
        filename: z.string().min(1).max(200),
        contentType: z.string().min(1).max(100),
        base64: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    checkPassword(data.password);
    const ext = data.filename.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(data.base64, "base64");
    const { error } = await supabaseAdmin.storage
      .from("menu-images")
      .upload(path, buffer, { contentType: data.contentType, upsert: false });
    if (error) throw new Error(error.message);
    const { data: pub } = supabaseAdmin.storage.from("menu-images").getPublicUrl(path);
    return { url: pub.publicUrl };
  });
