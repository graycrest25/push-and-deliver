let state;
export const sampleGameRules = () => ({
  enabled: true,
  activeLevel: "easy",
  levels: {
    easy: { speedMultiplier: 0.5, toleranceMilliseconds: 100 },
    medium: { speedMultiplier: 1, toleranceMilliseconds: 100 },
    hard: { speedMultiplier: 2, toleranceMilliseconds: 100 },
  },
  maxRewardsPerDay: 10,
  maxRewardsPerUserDay: 1,
});
const sampleCampaign = () => ({
  id: "campaign-game-1",
  title: "Ten Seconds delivery",
  percentageDiscount: 10,
  validForHours: 24,
  eligibleServices: ["courier"],
  enabled: true,
  gameEligible: true,
  version: 2,
});
export function resetGame() {
  state = {
    enabled: false,
    rules: sampleGameRules(),
    version: 3,
    invalid: false,
    receipts: new Map(),
    campaigns: [sampleCampaign()],
    loseResponse: false,
    readFailure: false,
    readbackFailure: false,
    nextReadFailure: false,
    conflict: false,
    rateLimit: false,
  };
}
resetGame();
export function controlGame(body) {
  if (body.game) state.enabled = true;
  if (Object.hasOwn(body, "gameRules")) state.rules = body.gameRules;
  if (Object.hasOwn(body, "gameVersion")) state.version = body.gameVersion;
  if (body.gameCampaigns) state.campaigns = body.gameCampaigns;
  for (const [input, field] of [
    ["gameInvalid", "invalid"],
    ["gameLoseResponse", "loseResponse"],
    ["gameReadFailure", "readFailure"],
    ["gameReadbackFailure", "readbackFailure"],
    ["gameConflict", "conflict"],
    ["gameRateLimit", "rateLimit"],
  ])
    if (Object.hasOwn(body, input)) state[field] = body[input];
}
function snapshot() {
  const configured = !!state.rules && !state.invalid;
  return {
    configured,
    version: state.version,
    configuration: configured
      ? {
          ...state.rules,
          version: state.version,
          targetMilliseconds: 10000,
          maxAttempts: 5,
          cooldownSeconds: 86400,
        }
      : null,
    reason: configured ? null : state.invalid ? "invalid" : "missing",
    updatedAt: state.version ? "2026-11-04T12:00:00Z" : null,
  };
}
export function gameApi(path, req, res, body, role) {
  if (
    !state.enabled ||
    !(
      path === "/v1/admin/game/rules" ||
      path === "/v1/admin/coupons/campaigns" ||
      /^\/v1\/admin\/coupons\/campaigns\/[^/]+\/status$/.test(path)
    )
  )
    return false;
  const reply = (status, data, headers = {}, isError = false) => {
    res.writeHead(status, { "content-type": "application/json", ...headers });
    res.end(
      JSON.stringify(isError ? data : { data, requestId: "game-request" }),
    );
    return true;
  };
  const error = (status, message, details = {}, headers = {}) =>
    reply(
      status,
      {
        error: {
          code: status === 409 ? "conflict" : "request_failed",
          message,
          details,
        },
        requestId: "game-request",
      },
      headers,
      true,
    );
  if (
    (path === "/v1/admin/game/rules" && role !== "super") ||
    !["super", "regular"].includes(role)
  )
    return error(403, "Game rules require super-administrator access");
  if (req.method === "GET" && path === "/v1/admin/game/rules") {
    if (state.readFailure || state.nextReadFailure) {
      state.nextReadFailure = false;
      return error(503, "Game rules read unavailable");
    }
    return reply(200, snapshot());
  }
  if (req.method === "GET" && path === "/v1/admin/coupons/campaigns") {
    const query = new URL(req.url, "http://localhost").searchParams;
    const offset = Number(
      (query.get("cursor") || "campaign-page-0").split("-").at(-1),
    );
    const limit = Number(query.get("limit") || 25);
    const hasMore = offset + limit < state.campaigns.length;
    return reply(200, {
      items: state.campaigns.slice(offset, offset + limit),
      nextCursor: hasMore ? `campaign-page-${offset + limit}` : null,
      hasMore,
    });
  }
  const key = req.headers["idempotency-key"];
  if (!key) return error(400, "Missing operation key");
  const signature = JSON.stringify([path, body]);
  if (state.receipts.has(key)) {
    const receipt = state.receipts.get(key);
    return receipt.signature === signature
      ? reply(200, receipt.response)
      : error(409, "The idempotency key changed");
  }
  if (state.rateLimit) {
    state.rateLimit = false;
    return error(429, "Too many saves", {}, { "retry-after": "1" });
  }
  let response;
  if (path === "/v1/admin/game/rules") {
    if (
      req.method !== "PUT" ||
      Object.keys(body).sort().join(",") !==
        "activeLevel,enabled,expectedVersion,levels,maxRewardsPerDay,maxRewardsPerUserDay" ||
      Object.keys(body.levels || {})
        .sort()
        .join(",") !== "easy,hard,medium"
    )
      return error(400, "Invalid game rule fields");
    if (state.conflict) {
      state.conflict = false;
      state.version++;
    }
    if (body.expectedVersion !== state.version)
      return error(409, "The saved game rules changed", {
        reason: "version_conflict",
        currentVersion: state.version,
      });
    const { expectedVersion, ...rules } = body;
    state.rules = structuredClone(rules);
    state.invalid = false;
    state.version++;
    response = snapshot();
    if (state.readbackFailure) {
      state.readbackFailure = false;
      state.nextReadFailure = true;
    }
  } else if (path === "/v1/admin/coupons/campaigns") {
    if (
      req.method !== "POST" ||
      Object.keys(body).sort().join(",") !==
        "eligibleServices,enabled,gameEligible,percentageDiscount,title,validForHours"
    )
      return error(400, "Unexpected campaign fields");
    response = { ...body, id: "created-game-campaign", version: 1 };
    state.campaigns.unshift(response);
  } else {
    const campaign = state.campaigns.find(
      (item) => item.id === path.split("/")[5],
    );
    if (!campaign) return error(404, "Campaign missing");
    if (
      req.method !== "POST" ||
      !Object.hasOwn(body, "enabled") ||
      !Object.hasOwn(body, "expectedVersion") ||
      Object.keys(body).some(
        (key) => !["enabled", "expectedVersion", "gameEligible"].includes(key),
      )
    )
      return error(400, "Unexpected campaign status fields");
    if (body.expectedVersion !== campaign.version)
      return error(409, "Campaign version changed", {
        reason: "version_conflict",
        currentVersion: campaign.version,
      });
    campaign.enabled = body.enabled;
    if (Object.hasOwn(body, "gameEligible"))
      campaign.gameEligible = body.gameEligible;
    campaign.version++;
    response = structuredClone(campaign);
  }
  state.receipts.set(key, { signature, response });
  if (state.loseResponse) {
    state.loseResponse = false;
    return error(503, "Game save response lost");
  }
  return reply(200, response);
}
