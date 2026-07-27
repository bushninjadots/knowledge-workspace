import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: Record<string, unknown> | null = null;

    // GitHub
    const githubMatch = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (githubMatch) {
      const [, owner, repo] = githubMatch;
      const cleanRepo = repo.replace(/\.git$/, "");
      const apiRes = await fetch(
        `https://api.github.com/repos/${owner}/${cleanRepo}`,
        {
          headers: { Accept: "application/vnd.github.v3+json" },
        },
      );
      if (apiRes.ok) {
        const data = await apiRes.json();
        result = {
          name: data.name,
          description: data.description,
          platform: "github",
          url: data.html_url,
          logo: data.owner?.avatar_url ?? null,
          stars: data.stargazers_count,
          language: data.language,
          owner: data.owner?.login,
        };
      }
    }

    // GitLab
    if (!result) {
      const gitlabMatch = url.match(/gitlab\.com\/(.+?)(?:\.git)?$/);
      if (gitlabMatch) {
        const projectPath = encodeURIComponent(gitlabMatch[1].replace(/\/$/, ""));
        const apiRes = await fetch(
          `https://gitlab.com/api/v4/projects/${projectPath}`,
        );
        if (apiRes.ok) {
          const data = await apiRes.json();
          result = {
            name: data.name,
            description: data.description,
            platform: "gitlab",
            url: data.web_url,
            logo: data.avatar_url ?? null,
            stars: data.star_count,
            language: null,
            owner: data.owner?.username ?? null,
          };
        }
      }
    }

    // Codeberg (Gitea)
    if (!result) {
      const codebergMatch = url.match(/codeberg\.org\/([^/]+)\/([^/]+)/);
      if (codebergMatch) {
        const [, owner, repo] = codebergMatch;
        const cleanRepo = repo.replace(/\.git$/, "");
        const apiRes = await fetch(
          `https://codeberg.org/api/v1/repos/${owner}/${cleanRepo}`,
        );
        if (apiRes.ok) {
          const data = await apiRes.json();
          result = {
            name: data.name,
            description: data.description,
            platform: "codeberg",
            url: data.html_url,
            logo: data.owner?.avatar_url ?? null,
            stars: data.stars_count,
            language: data.language,
            owner: data.owner?.login,
          };
        }
      }
    }

    // Open Graph fallback for everything else
    if (!result) {
      try {
        const pageRes = await fetch(url, {
          headers: { "User-Agent": "Tethyr/1.0" },
          signal: AbortSignal.timeout(10_000),
        });
        const html = await pageRes.text();

        const ogTitle = html.match(
          /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i,
        );
        const ogDesc = html.match(
          /<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i,
        );
        const ogImage = html.match(
          /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i,
        );

        const hostname = new URL(url).hostname.replace("www.", "");

        result = {
          name: ogTitle?.[1] ?? hostname,
          description: ogDesc?.[1] ?? null,
          platform: "website",
          url,
          logo: ogImage?.[1] ?? null,
        };
      } catch {
        // If OG scrape fails, return minimal info
        const hostname = new URL(url).hostname.replace("www.", "");
        result = {
          name: hostname,
          description: null,
          platform: "other",
          url,
          logo: null,
        };
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
