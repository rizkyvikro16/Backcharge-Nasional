export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/d1/query" && request.method === "POST") {
      try {
        const { sql, params } = await request.json();

        // Ensure database is bound
        if (!env.DB) {
          return new Response(
            JSON.stringify({ success: false, error: "Database 'DB' tidak di-binding ke Worker ini." }),
            { headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        let stmt = env.DB.prepare(sql);
        if (params && params.length > 0) {
          stmt = stmt.bind(...params);
        }

        const result = await stmt.all();
        
        return new Response(
          JSON.stringify({ success: true, results: result.results }),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ success: false, error: err.message }),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    return new Response("Backcharge API Worker Running", { headers: corsHeaders });
  }
};
