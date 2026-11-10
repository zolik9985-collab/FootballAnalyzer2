const http = require("http");
const https = require("https");
const { URL } = require("url");

const PORT = process.env.PORT || 10000;
const KEY = process.env.API_SH_KEY || "";

function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(data));
}

function proxy(path, res) {
  if (!KEY) return send(res, 503, {error: "API_SH_KEY is not configured"});

  const req = https.get({
    hostname: "api.api.sh",
    path,
    headers: {"x-api-key": KEY}
  }, upstream => {
    let body = "";
    upstream.on("data", chunk => body += chunk);
    upstream.on("end", () => {
      res.writeHead(upstream.statusCode || 502, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      });
      res.end(body);
    });
  });

  req.on("error", e => send(res, 502, {error: e.message}));
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/health")
    return send(res, 200, {ok: true, api_key_configured: !!KEY});

  if (url.pathname === "/flashscore/v1/live") {
    const sport = url.searchParams.get("sport") || "football";
    if (!["football", "hockey"].includes(sport))
      return send(res, 400, {error: "Invalid sport"});
    return proxy(`/flashscore/v1/live?sport=${sport}`, res);
  }

  if (url.pathname === "/flashscore/v1/matches") {
    const sport = url.searchParams.get("sport");
    const date = url.searchParams.get("date");
    if (!["football", "hockey"].includes(sport) ||
        !/^\\d{4}-\\d{2}-\\d{2}$/.test(date || ""))
      return send(res, 400, {error: "Invalid parameters"});
    return proxy(`/flashscore/v1/matches?sport=${sport}&date=${date}`, res);
  }

  if (url.pathname === "/flashscore/v1/match/statistics") {
    const id = url.searchParams.get("match_id");
    if (!id) return send(res, 400, {error: "match_id required"});
    return proxy(`/flashscore/v1/match/statistics?match_id=${encodeURIComponent(id)}`, res);
  }

  send(res, 404, {error: "Not found"});
}).listen(PORT, "0.0.0.0");
