import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import type { Tables } from '@/integrations/supabase/types'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

export type Category = Tables<'categories'>
export type MenuItem = Tables<'menu_items'>
export type RestaurantInfo = Tables<'restaurant_info'>

export type MenuData = {
  categories: Category[]
  items: MenuItem[]
  info: RestaurantInfo | null
}

export const getMenuData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<MenuData> => {
    try {
      const [cats, items, info] = await Promise.all([
        supabaseAdmin.from('categories').select('*').order('sort_order'),
        supabaseAdmin.from('menu_items').select('*').order('sort_order'),
        supabaseAdmin
          .from('restaurant_info')
          .select('*')
          .limit(1)
          .maybeSingle(),
      ])

      if (cats.error) console.error('Supabase categories error:', cats.error)
      if (items.error) console.error('Supabase items error:', items.error)
      if (info.error) console.error('Supabase info error:', info.error)

      return {
        categories: cats.data ?? [],
        items: items.data ?? [],
        info: info.data ?? null,
      }
    } catch (err) {
      console.error('getMenuData fatal error:', err)
      throw err
    }
  },
)

async function checkAuth() {
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) throw new Error('Unauthorized')
  return session
}

export const verifyAdminPassword = createServerFn({ method: 'POST' }).handler(
  async () => {
    await checkAuth()
    return { ok: true }
  },
)

const ItemSchema = z.object({
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
  is_special: z.boolean().optional().default(false),
  sort_order: z.number().int().min(0).max(10000),
  gallery: z.array(z.string()).optional().nullable(),
  dietary: z.array(z.string()).optional().nullable(),
})

export const upsertMenuItem = createServerFn({ method: 'POST' })
  .inputValidator((d) => ItemSchema.parse(d))
  .handler(async ({ data }) => {
    await checkAuth()
    const { id, ...payload } = data
    if (id) {
      const { error } = await supabaseAdmin
        .from('menu_items')
        .update({
          ...payload,
          gallery: payload.gallery,
          dietary: payload.dietary,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', id)
      if (error) throw new Error(error.message)
      return { id }
    }
    const { data: inserted, error } = await supabaseAdmin
      .from('menu_items')
      .insert({
        ...payload,
        gallery: payload.gallery,
        dietary: payload.dietary,
      } as any)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return { id: inserted.id }
  })

export const deleteMenuItem = createServerFn({ method: 'POST' })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await checkAuth()
    const { error } = await supabaseAdmin
      .from('menu_items')
      .delete()
      .eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const toggleAvailability = createServerFn({ method: 'POST' })
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), is_available: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    await checkAuth()
    const { error } = await supabaseAdmin
      .from('menu_items')
      .update({ is_available: data.is_available })
      .eq('id', data.id)
    if (error) throw new Error(error.message)

    // Broadcast the availability change directly so we don't depend on Postgres replication slots
    await supabaseAdmin.channel('menu-availability').send({
      type: 'broadcast',
      event: 'toggle',
      payload: { id: data.id, is_available: data.is_available },
    })

    return { ok: true }
  })

const CategorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  name_am: z.string().max(80).nullable().optional(),
  sort_order: z.number().int().min(0).max(10000),
})

export const upsertCategory = createServerFn({ method: 'POST' })
  .inputValidator((d) => CategorySchema.parse(d))
  .handler(async ({ data }) => {
    await checkAuth()
    const { id, ...payload } = data
    if (id) {
      const { error } = await supabaseAdmin
        .from('categories')
        .update(payload)
        .eq('id', id)
      if (error) throw new Error(error.message)
      return { id }
    }
    const { data: inserted, error } = await supabaseAdmin
      .from('categories')
      .insert(payload)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return { id: inserted.id }
  })

export const deleteCategory = createServerFn({ method: 'POST' })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await checkAuth()
    const { error } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const reorderMenuItems = createServerFn({ method: 'POST' })
  .inputValidator((d) =>
    z
      .object({
        updates: z.array(
          z.object({ id: z.string().uuid(), sort_order: z.number() }),
        ),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await checkAuth()
    for (const { id, sort_order } of data.updates) {
      await supabaseAdmin
        .from('menu_items')
        .update({ sort_order, updated_at: new Date().toISOString() })
        .eq('id', id)
    }
    return { ok: true }
  })

export const reorderCategories = createServerFn({ method: 'POST' })
  .inputValidator((d) =>
    z
      .object({
        updates: z.array(
          z.object({ id: z.string().uuid(), sort_order: z.number() }),
        ),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await checkAuth()
    for (const { id, sort_order } of data.updates) {
      await supabaseAdmin.from('categories').update({ sort_order }).eq('id', id)
    }
    return { ok: true }
  })

const InfoSchema = z.object({
  name: z.string().min(1).max(120),
  tagline: z.string().max(200).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(60).nullable().optional(),
  instagram_url: z.string().max(200).nullable().optional().or(z.literal('')),
  tiktok_url: z.string().max(200).nullable().optional().or(z.literal('')),
  facebook_url: z.string().max(200).nullable().optional().or(z.literal('')),
  telegram_url: z.string().max(200).nullable().optional().or(z.literal('')),
  whatsapp_url: z.string().max(200).nullable().optional().or(z.literal('')),
  youtube_url: z.string().max(200).nullable().optional().or(z.literal('')),
  map_url: z.string().max(500).nullable().optional().or(z.literal('')),
  map_embed_url: z.string().max(2000).nullable().optional().or(z.literal('')),
  max_tables: z.number().int().min(1).max(9999).optional().nullable(),
  hours: z
    .array(z.object({ day: z.string().max(40), hours: z.string().max(80) }))
    .max(14),
  wifi_password: z.string().max(100).nullable().optional(),
  service_charge_pct: z.number().min(0).max(100).nullable().optional(),
  promo_banner_active: z.boolean().nullable().optional(),
  promo_banner_text: z.string().max(300).nullable().optional(),
  promo_banner_text_am: z.string().max(300).nullable().optional(),
  promo_banner_url: z.string().max(500).nullable().optional(),
  promo_banner_item_id: z.string().uuid().nullable().optional(),
  payment_methods: z.any().nullable().optional(),
  dietary_tags: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        label_am: z.string().optional(),
      }),
    )
    .optional()
    .nullable(),
})

export const updateRestaurantInfo = createServerFn({ method: 'POST' })
  .inputValidator((d) => InfoSchema.parse(d))
  .handler(async ({ data }) => {
    await checkAuth()
    const payload = data
    const { data: existing } = await supabaseAdmin
      .from('restaurant_info')
      .select('id')
      .limit(1)
      .maybeSingle()
    const cleaned = {
      ...payload,
      instagram_url: payload.instagram_url || null,
      tiktok_url: payload.tiktok_url || null,
      facebook_url: (payload as any).facebook_url || null,
      telegram_url: (payload as any).telegram_url || null,
      whatsapp_url: (payload as any).whatsapp_url || null,
      youtube_url: (payload as any).youtube_url || null,
      map_url: payload.map_url || null,
      map_embed_url: payload.map_embed_url || null,
      promo_banner_item_id: payload.promo_banner_item_id || null,
      promo_banner_text_am: payload.promo_banner_text_am || null,
      updated_at: new Date().toISOString(),
    }
    if (existing) {
      const { error } = await supabaseAdmin
        .from('restaurant_info')
        .update(cleaned as any)
        .eq('id', existing.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabaseAdmin
        .from('restaurant_info')
        .insert(cleaned as any)
      if (error) throw new Error(error.message)
    }
    return { ok: true }
  })

export const uploadItemImage = createServerFn({ method: 'POST' })
  .inputValidator((d) =>
    z
      .object({
        filename: z.string().min(1).max(200),
        contentType: z.string().min(1).max(100),
        base64: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await checkAuth()
    const ext = data.filename.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${crypto.randomUUID()}.${ext}`
    const buffer = Buffer.from(data.base64, 'base64')
    const { error } = await supabaseAdmin.storage
      .from('menu-images')
      .upload(path, buffer, { contentType: data.contentType, upsert: false })
    if (error) throw new Error(error.message)
    const { data: pub } = supabaseAdmin.storage
      .from('menu-images')
      .getPublicUrl(path)
    return { url: pub.publicUrl }
  })

export const generateItemDescription = createServerFn({ method: 'POST' })
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(1).max(120),
        name_am: z.string().max(120).optional(),
        price: z.number().optional(),
        is_vegetarian: z.boolean().optional(),
        is_spicy: z.boolean().optional(),
        is_fasting: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await checkAuth()
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const flags = [
      data.is_vegetarian ? 'vegetarian' : '',
      data.is_fasting ? 'fasting-friendly' : '',
      data.is_spicy ? 'spicy' : '',
    ]
      .filter(Boolean)
      .join(', ')

    const prompt = `You are a creative food copywriter for "Origin Restaurant" in Addis Ababa, Ethiopia.
Write a short, appetizing menu description for the dish below. Be sensory and evocative. Max 2 sentences per language.

Dish: ${data.name}${data.name_am ? ` (${data.name_am})` : ''}
Price: ${data.price ?? ''}  ETB
Attributes: ${flags || 'none'}

Respond ONLY with a JSON object in this exact format (no extra text):
{"description": "...", "description_am": "..."}

For description_am, write in Amharic script. Keep both descriptions concise and appetizing.`

    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      prompt,
      temperature: 0.8,
    })

    // Strip possible markdown code fences
    const cleaned = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      description: parsed.description ?? '',
      description_am: parsed.description_am ?? '',
    }
  })
