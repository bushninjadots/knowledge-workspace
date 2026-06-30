
-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  country TEXT,
  timezone TEXT,
  languages TEXT[] NOT NULL DEFAULT '{}',
  category TEXT,
  years_experience INT,
  portfolio_links JSONB NOT NULL DEFAULT '[]',
  social_links JSONB NOT NULL DEFAULT '{}',
  available_days TEXT[] NOT NULL DEFAULT '{}',
  available_times TEXT[] NOT NULL DEFAULT '{}',
  teaching_style TEXT,
  learning_goals TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users delete own profile" ON public.profiles FOR DELETE USING (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, handle, category)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'handle', 'user_' || substr(NEW.id::text, 1, 8)),
    NEW.raw_user_meta_data->>'craft'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SKILLS catalog
CREATE TABLE public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.skills TO anon, authenticated;
GRANT ALL ON public.skills TO service_role;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Skills are public" ON public.skills FOR SELECT USING (true);

-- Seed skills
INSERT INTO public.skills (slug, name, category) VALUES
  ('premiere-pro','Premiere Pro','Video Editing'),
  ('davinci-resolve','DaVinci Resolve','Video Editing'),
  ('final-cut-pro','Final Cut Pro','Video Editing'),
  ('capcut','CapCut','Video Editing'),
  ('after-effects','After Effects','Motion Design'),
  ('motion-graphics','Motion Graphics','Motion Design'),
  ('cinema-4d','Cinema 4D','Motion Design'),
  ('blender','Blender','3D'),
  ('photoshop','Photoshop','Graphic Design'),
  ('illustrator','Illustrator','Graphic Design'),
  ('figma','Figma','Design'),
  ('canva','Canva','Graphic Design'),
  ('lightroom','Lightroom','Photography'),
  ('portrait-photography','Portrait Photography','Photography'),
  ('product-photography','Product Photography','Photography'),
  ('color-grading','Color Grading','Video Editing'),
  ('sound-design','Sound Design','Audio'),
  ('music-production','Music Production','Audio'),
  ('ableton-live','Ableton Live','Audio'),
  ('logic-pro','Logic Pro','Audio'),
  ('flstudio','FL Studio','Audio'),
  ('seo','SEO','Marketing'),
  ('wordpress','WordPress','Web'),
  ('webflow','Webflow','Web'),
  ('youtube-growth','YouTube Growth','Creator Growth'),
  ('thumbnail-design','Thumbnail Design','Creator Growth'),
  ('streaming','Streaming','Creator Growth'),
  ('obs','OBS Studio','Streaming'),
  ('twitch-growth','Twitch Growth','Creator Growth'),
  ('tiktok-growth','TikTok Growth','Creator Growth'),
  ('instagram-growth','Instagram Growth','Creator Growth'),
  ('social-media','Social Media Strategy','Marketing'),
  ('copywriting','Copywriting','Writing'),
  ('scriptwriting','Scriptwriting','Writing'),
  ('programming','Programming','Development'),
  ('javascript','JavaScript','Development'),
  ('react','React','Development'),
  ('python','Python','Development'),
  ('ai-tools','AI Tools','Development'),
  ('prompt-engineering','Prompt Engineering','Development'),
  ('branding','Branding','Design'),
  ('typography','Typography','Design'),
  ('storytelling','Storytelling','Creator Growth');

-- Teach / learn join tables
CREATE TABLE public.profile_skills_teach (
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, skill_id)
);
GRANT SELECT ON public.profile_skills_teach TO anon;
GRANT SELECT, INSERT, DELETE ON public.profile_skills_teach TO authenticated;
GRANT ALL ON public.profile_skills_teach TO service_role;
ALTER TABLE public.profile_skills_teach ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teach skills viewable by everyone" ON public.profile_skills_teach FOR SELECT USING (true);
CREATE POLICY "Users manage own teach skills insert" ON public.profile_skills_teach FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users manage own teach skills delete" ON public.profile_skills_teach FOR DELETE USING (auth.uid() = profile_id);

CREATE TABLE public.profile_skills_learn (
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, skill_id)
);
GRANT SELECT ON public.profile_skills_learn TO anon;
GRANT SELECT, INSERT, DELETE ON public.profile_skills_learn TO authenticated;
GRANT ALL ON public.profile_skills_learn TO service_role;
ALTER TABLE public.profile_skills_learn ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Learn skills viewable by everyone" ON public.profile_skills_learn FOR SELECT USING (true);
CREATE POLICY "Users manage own learn skills insert" ON public.profile_skills_learn FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users manage own learn skills delete" ON public.profile_skills_learn FOR DELETE USING (auth.uid() = profile_id);

-- Storage policies for avatars bucket
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
