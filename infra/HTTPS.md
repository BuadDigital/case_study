# Production HTTPS

Production TLS terminates at nginx. The application containers remain reachable only
through the private Compose network and do not receive the certificate private key.

## One-time host setup

Provision a certificate on the VPS (for example with Certbot), then add these GitHub
Actions repository secrets:

- `TLS_CERTIFICATE_PATH`: absolute path to the certificate chain on the VPS, such as
  `/etc/letsencrypt/live/app.example.com/fullchain.pem`
- `TLS_PRIVATE_KEY_PATH`: absolute path to its private key, such as
  `/etc/letsencrypt/live/app.example.com/privkey.pem`
- `PUBLIC_APP_URL`: the public HTTPS origin, such as `https://app.example.com`

The deploy job refuses to change the running stack when either certificate file is
missing or unreadable. Compose mounts both files read-only into nginx.

## Renewal

After Certbot renews a certificate, reload nginx so it reads the new files:

```sh
docker compose -f /app/docker-compose.prod.yml exec nginx nginx -s reload
```

Port 80 remains open only to issue a permanent redirect to HTTPS. Port 443 is the only
public application endpoint.
