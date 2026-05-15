FROM openresty/openresty:1.27.1.2-0-alpine

RUN apk add --no-cache perl curl
RUN /usr/local/openresty/bin/opm get cdbattags/lua-resty-jwt
RUN /usr/local/openresty/bin/opm get openresty/lua-resty-redis
RUN /usr/local/openresty/bin/opm get openresty/lua-resty-string

COPY nginx.conf /usr/local/openresty/nginx/conf/nginx.conf
COPY jwt_auth.lua /etc/nginx/lua/jwt_auth.lua
EXPOSE 8080
