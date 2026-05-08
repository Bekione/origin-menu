-- Schema for Origin Restaurant

-- Create Categories Table
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    name TEXT NOT NULL,
    name_am TEXT,
    sort_order INT NOT NULL DEFAULT 0
);

-- Create Menu Items Table
CREATE TABLE public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    name_am TEXT,
    description TEXT,
    description_am TEXT,
    price NUMERIC NOT NULL DEFAULT 0,
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT true,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    is_vegetarian BOOLEAN NOT NULL DEFAULT false,
    is_spicy BOOLEAN NOT NULL DEFAULT false,
    is_fasting BOOLEAN NOT NULL DEFAULT false,
    sort_order INT NOT NULL DEFAULT 0
);

-- Create Restaurant Info Table
CREATE TABLE public.restaurant_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    name TEXT NOT NULL DEFAULT 'Origin Restaurant',
    tagline TEXT,
    address TEXT,
    phone TEXT,
    hours JSONB,
    instagram_url TEXT,
    tiktok_url TEXT,
    map_url TEXT,
    map_embed_url TEXT
);

-- Initial Info row (must exist for admin info tab)
INSERT INTO public.restaurant_info (name) VALUES ('Origin Restaurant');

-- Create Storage Bucket for Menu Images
INSERT INTO storage.buckets (id, name, public) VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage public read policy
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'menu-images');
CREATE POLICY "Anon Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'menu-images');
CREATE POLICY "Anon Update" ON storage.objects FOR UPDATE USING (bucket_id = 'menu-images');
CREATE POLICY "Anon Delete" ON storage.objects FOR DELETE USING (bucket_id = 'menu-images');
