#!/usr/bin/env bash
set -euo pipefail
# Run with sudo. This VPS forwards public HTTPS to 127.0.0.1:8443.
# The jobs API already has its own Nginx configuration and certificate.
install -d /var/www/letsencrypt
conf=/etc/nginx/sites-available/04-jobs-frontend
if [ -f "$conf" ]; then cp "$conf" "$conf.bak.$(date +%s)"; fi
cat > "$conf" <<'NGINX'
server {
    listen 80;
    server_name jobs.dadu.edu.et;
    location /.well-known/acme-challenge/ { root /var/www/letsencrypt; }
    location / { return 301 https://$host$request_uri; }
}
NGINX
ln -sfn "$conf" /etc/nginx/sites-enabled/04-jobs-frontend
nginx -t
systemctl reload nginx
certbot certonly --webroot -w /var/www/letsencrypt --non-interactive --agree-tos --register-unsafely-without-email --cert-name jobs.dadu.edu.et -d jobs.dadu.edu.et
cat >> "$conf" <<'NGINX'
server {
    listen 127.0.0.1:8443 ssl;
    server_name jobs.dadu.edu.et;
    ssl_certificate /etc/letsencrypt/live/jobs.dadu.edu.et/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/jobs.dadu.edu.et/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    client_max_body_size 50M;
    location / {
        proxy_pass http://127.0.0.1:3015;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_read_timeout 120s;
    }
}
NGINX
nginx -t
systemctl reload nginx
