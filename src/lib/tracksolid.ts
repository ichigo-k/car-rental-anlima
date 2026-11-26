import { createHash } from "node:crypto";
import { db } from "./db";

// Tracksolid Pro (Jimi IoT) Open API client. Docs:
// https://tracksolidprodocs.jimicloud.com/integration/integration.html
// Every call is a signed POST to the node that owns the ANLIMA account.
const NODES: Record<string, string> = {
  hk: "https://hk-open.tracksolidpro.com/route/rest",
  eu: "https://eu-open.tracksolidpro.com/route/rest",
  us: "https://us-open.tracksolidpro.com/route/rest",
};
export type TracksolidConfig = {
  url: string;
  appKey: string;
  appSecret: string;
  account: string;
  passwordMd5: string;
};
export function tracksolidConfig(
  env: Record<string, string | undefined> = process.env,
): TracksolidConfig | null {
  const appKey = env.TRACKSOLID_APP_KEY;
  const appSecret = env.TRACKSOLID_APP_SECRET;
  const account = env.TRACKSOLID_ACCOUNT;
  // The account password's MD5 (Tracksolid's user_pwd_md5) is preferred so
  // the plain password need not be stored; the password itself also works.
  const hashed = env.TRACKSOLID_PASSWORD_MD5?.trim().toLowerCase();
  const password = env.TRACKSOLID_PASSWORD;
  if (hashed && !/^[0-9a-f]{32}$/.test(hashed)) return null;
  if (!appKey || !appSecret || !account || (!hashed && !password)) return null;
  const url =
    env.TRACKSOLID_BASE_URL ??
    NODES[(env.TRACKSOLID_NODE ?? "hk").toLowerCase()];
  if (!url) return null;
  return {
    url,
    appKey,
    appSecret,
    account,
    passwordMd5: hashed || md5(password!).toLowerCase(),
  };
}

const md5 = (text: string) =>
  createHash("md5").update(text, "utf8").digest("hex");
// Sort parameters by key, join key+value pairs, wrap in the app secret, MD5,
// upper case. `sign` itself and empty values are excluded.
export function signParams(params: Record<string, string>, appSecret: string) {
  const body = Object.keys(params)
    .filter((k) => k !== "sign" && params[k] !== "")
    .sort()
    .map((k) => k + params[k])
    .join("");
  return md5(appSecret + body + appSecret).toUpperCase();
}
// "yyyy-MM-dd HH:mm:ss" in UTC, as the API expects and returns.
export function tracksolidTime(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}
export function parseTracksolidTime(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value)
  )
    return null;
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}

export class TracksolidError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}
async function call<T>(
  config: TracksolidConfig,
  method: string,
  params: Record<string, string>,
): Promise<T> {
  const body: Record<string, string> = {
    method,
    timestamp: tracksolidTime(new Date()),
    app_key: config.appKey,
    sign_method: "md5",
    v: "1.0",
    format: "json",
    ...params,
  };
  body.sign = signParams(body, config.appSecret);
  const response = await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new TracksolidError(
      -1,
      `Tracksolid returned HTTP ${response.status}`,
    );
  const json = (await response.json()) as {
    code: number | string;
    message?: string;
    result?: T;
  };
  if (Number(json.code) !== 0)
    throw new TracksolidError(
      Number(json.code),
      json.message || "Tracksolid request failed",
    );
  return json.result as T;
}

// The access token lasts up to two hours and must be reused, not requested
// for every call. It is cached in the database so restarts share it.
const TOKEN_KEY = "tracksolid.token";
async function accessToken(config: TracksolidConfig, renew = false) {
  if (!renew) {
    const cached = await db.integrationState.findUnique({
      where: { key: TOKEN_KEY },
    });
    if (cached?.expiresAt && cached.expiresAt.getTime() > Date.now() + 300000)
      return cached.value;
  }
  const result = await call<{
    accessToken: string;
    expiresIn: number | string;
  }>(config, "jimi.oauth.token.get", {
    user_id: config.account,
    user_pwd_md5: config.passwordMd5,
    expires_in: "7200",
  });
  const expiresAt = new Date(Date.now() + Number(result.expiresIn) * 1000);
  await db.integrationState.upsert({
    where: { key: TOKEN_KEY },
    create: { key: TOKEN_KEY, value: result.accessToken, expiresAt },
    update: { value: result.accessToken, expiresAt },
  });
  return result.accessToken;
}
// Code 1004: token failure or nonexistent. Renew once and retry.
async function withToken<T>(
  config: TracksolidConfig,
  run: (token: string) => Promise<T>,
) {
  try {
    return await run(await accessToken(config));
  } catch (error) {
    if (!(error instanceof TracksolidError) || error.code !== 1004) throw error;
    return run(await accessToken(config, true));
  }
}

export type TracksolidDevice = {
  imei: string;
  deviceName?: string;
  vehicleName?: string;
  vehicleNumber?: string;
  enabledFlag?: number;
};
export function listDevices(config: TracksolidConfig) {
  return withToken(config, (token) =>
    call<TracksolidDevice[]>(config, "jimi.user.device.list", {
      access_token: token,
      target: config.account,
    }),
  );
}
export type TracksolidLocation = {
  imei: string;
  status?: string | number;
  lat?: number | string;
  lng?: number | string;
  gpsTime?: string;
  hbTime?: string;
  speed?: number | string;
  direction?: number | string;
  accStatus?: number | string;
  expireFlag?: number | string;
};
export type TracksolidTrackPoint = {
  lat?: number | string;
  lng?: number | string;
  gpsTime?: string;
  gpsSpeed?: number | string;
  direction?: number | string;
};
// Recorded route for one tracker between two times (UTC).
export async function deviceTrack(
  config: TracksolidConfig,
  imei: string,
  from: Date,
  to: Date,
) {
  return (
    (await withToken(config, (token) =>
      call<TracksolidTrackPoint[]>(config, "jimi.device.track.list", {
        access_token: token,
        imei,
        begin_time: tracksolidTime(from),
        end_time: tracksolidTime(to),
        map_type: "GOOGLE",
      }),
    )) ?? []
  );
}
// At most 100 IMEIs per call.
export async function deviceLocations(
  config: TracksolidConfig,
  imeis: string[],
) {
  const results: TracksolidLocation[] = [];
  for (let i = 0; i < imeis.length; i += 100) {
    const batch = imeis.slice(i, i + 100).join(",");
    results.push(
      ...((await withToken(config, (token) =>
        call<TracksolidLocation[]>(config, "jimi.device.location.get", {
          access_token: token,
          imeis: batch,
        }),
      )) ?? []),
    );
  }
  return results;
}

// Remote fuel/power cut-off (immobilisation) through the tracker's relay:
// "RELAY,1#" cuts the fuel pump or starter circuit and "RELAY,0#" restores
// it. Only works where the installer has wired the relay.
export type TracksolidInstruction = {
  id: string | number;
  orderName?: string | null;
  orderContent?: string | null;
};
export type RelayAction = "cut" | "restore";
// The instruction to send, from the commands the device lists: its own relay
// command if it has one, otherwise its user-defined command.
export function relayInstruction(
  list: TracksolidInstruction[],
  action: RelayAction,
) {
  const value = action === "cut" ? "1" : "0";
  const relay = list.find((i) =>
    /^RELAY,\{0\}#$/i.test(i.orderContent?.trim() ?? ""),
  );
  if (relay)
    return {
      inst_id: String(relay.id),
      inst_template: relay.orderContent!.trim(),
      params: [value],
      is_cover: "true",
    };
  const custom = list.find((i) => i.orderContent?.trim() === "{0}");
  if (custom)
    return {
      inst_id: String(custom.id),
      inst_template: "{0}",
      params: [`RELAY,${value}#`],
      is_cover: "true",
    };
  return null;
}
export async function sendRelay(
  config: TracksolidConfig,
  imei: string,
  action: RelayAction,
) {
  return withToken(config, async (token) => {
    const list =
      (await call<TracksolidInstruction[]>(
        config,
        "jimi.open.instruction.list",
        { access_token: token, imei },
      )) ?? [];
    const instruction = relayInstruction(list, action);
    if (!instruction)
      throw new TracksolidError(
        -1,
        "This tracker does not offer a fuel/power cut-off command",
      );
    await call(config, "jimi.open.instruction.send", {
      access_token: token,
      imei,
      inst_param_json: JSON.stringify(instruction),
    });
  });
}
export type TracksolidInstructionResult = {
  code?: string;
  content?: string | null;
  isExecute?: string | number;
  sendTime?: string;
};
export type RelayOutcome = {
  action: RelayAction;
  state: "DONE" | "FAILED" | "WAITING" | "CANCELLED";
  reply: string | null;
  sentAt: string | null;
};
// The latest relay command among a device's command results.
export function latestRelayOutcome(
  results: TracksolidInstructionResult[],
): RelayOutcome | null {
  const relay = results
    .map((r) => ({
      r,
      match: /^RELAY,([01])#$/i.exec(r.code?.trim() ?? ""),
      at: parseTracksolidTime(r.sendTime),
    }))
    .filter((x) => x.match)
    .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))[0];
  if (!relay) return null;
  const execute = String(relay.r.isExecute);
  return {
    action: relay.match![1] === "1" ? "cut" : "restore",
    state:
      execute === "1"
        ? "DONE"
        : execute === "0"
          ? "FAILED"
          : execute === "4"
            ? "CANCELLED"
            : "WAITING",
    reply: relay.r.content?.trim() || null,
    sentAt: relay.at?.toISOString() ?? null,
  };
}
export async function relayOutcome(config: TracksolidConfig, imei: string) {
  const results = await withToken(config, (token) =>
    call<TracksolidInstructionResult[]>(
      config,
      "jimi.open.instruction.result",
      {
        access_token: token,
        imei,
      },
    ),
  );
  return latestRelayOutcome(results ?? []);
}
