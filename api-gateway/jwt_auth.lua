local cjson = require "cjson.safe"
local jwt = require "resty.jwt"
local redis = require "resty.redis"
local str = require "resty.string"

local function unauthorized(msg)
  ngx.status = ngx.HTTP_UNAUTHORIZED
  ngx.header["Content-Type"] = "application/json"
  ngx.say(cjson.encode({ error = msg or "Unauthorized" }))
  return ngx.exit(ngx.HTTP_UNAUTHORIZED)
end

local auth = ngx.var.http_authorization
if not auth then
  return unauthorized("Missing token")
end

local token = auth:match("^[Bb]earer%s+(.+)$")
if not token or token == "" then
  return unauthorized("Invalid token")
end

local key_file, key_err = io.open("/etc/gateway/keys/public.pem", "r")
if not key_file then
  ngx.log(ngx.ERR, "failed to open public key: ", key_err)
  return unauthorized("Invalid token")
end
local public_key = key_file:read("*a")
key_file:close()

local jwt_obj = jwt:verify(public_key, token)
if not jwt_obj or not jwt_obj.verified then
  if jwt_obj and jwt_obj.reason then
    ngx.log(ngx.ERR, "jwt verification failed: ", jwt_obj.reason)
  else
    ngx.log(ngx.ERR, "jwt verification failed: unknown error")
  end
  return unauthorized("Invalid token")
end

local payload = jwt_obj.payload or {}
local now = ngx.time()

if payload.exp and tonumber(payload.exp) and tonumber(payload.exp) <= now then
  return unauthorized("Token expired")
end

local expected_iss = os.getenv("JWT_EXPECTED_ISSUER")
if expected_iss and expected_iss ~= "" and payload.iss and payload.iss ~= expected_iss then
  return unauthorized("Invalid token")
end

-- Redis blacklist enforcement for logout invalidation
local resty_sha256 = require "resty.sha256"
local digest = resty_sha256:new()
digest:update(token)
local token_hash = str.to_hex(digest:final())
local red = redis:new()
red:set_timeout(1000)
local ok, err = red:connect(os.getenv("REDIS_HOST") or "redis", tonumber(os.getenv("REDIS_PORT") or "6379"))
if ok then
  local redis_db = tonumber(os.getenv("REDIS_DB") or "0")
  if redis_db and redis_db > 0 then
    red:select(redis_db)
  end
  local redis_password = os.getenv("REDIS_PASSWORD")
  if redis_password and redis_password ~= "" then
    red:auth(redis_password)
  end

  local key = "blacklisted:" .. token_hash
  local exists, exists_err = red:exists(key)
  if exists_err then
    ngx.log(ngx.ERR, "redis exists error: ", exists_err)
  elseif exists == 1 then
    return unauthorized("token revoked")
  end
else
  ngx.log(ngx.ERR, "redis connect error: ", err)
end

ngx.req.set_header("X-User-Id", tostring(payload.sub or ""))
ngx.req.set_header("X-User-Role", tostring(payload.role or ""))
ngx.req.set_header("X-User-Email", tostring(payload.email or ""))

return
