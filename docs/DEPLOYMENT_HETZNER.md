# النشر على Hetzner عبر CI/CD

دليل من الصفر: من سيرفر Ubuntu فاضي إلى موقع شغّال على HTTPS، مع نشر تلقائي عند كل `push` على `main`.

المسار كامل: `git push` → GitHub Actions يبني الصور ويرفعها على GHCR → يتصل بالسيرفر عبر SSH → يشغّل الهجرات (migrations) ثم يرفع الـ stack عبر Docker Compose → يتحقق من الصحة.

---

## 0. المتطلبات

- سيرفر Hetzner Cloud بـ Ubuntu، ومعه دخول SSH يعمل.
- **الحد الأدنى للموارد: 8 GB RAM و 4 vCPU** (مثل `CPX41` أو `CCX23`). الـ stack يشغّل 9 خدمات .NET + Gateway + Next.js + Postgres + RabbitMQ + Redis + Elasticsearch + Prometheus + Grafana + Jaeger. سيرفر بـ 4 GB سيُقتل بـ OOM.
- دومين تقدر تعدّل سجلات DNS الخاصة به.
- الريبو على GitHub: `BuadDigital/case_study`.

---

## الطريق السريع (سكربت واحد)

الأقسام 1 إلى 4 مؤتمتة في `infra/setup-hetzner-server.sh`. من السيرفر:

```sh
curl -fsSL -o setup.sh \
  https://raw.githubusercontent.com/BuadDigital/case_study/main/infra/setup-hetzner-server.sh
chmod +x setup.sh
./setup.sh app.example.com you@example.com
```

> الريبو خاص، فرابط `raw` يحتاج توكن. الأسهل: انسخ الملف من جهازك بـ
> `scp infra/setup-hetzner-server.sh root@SERVER_IP:~/`.

السكربت يثبّت Docker، يقفل الجدار الناري، ينشئ `/app`، يصدر شهادة Let's Encrypt،
يركّب خطافات التجديد، يولّد `/app/.env` بأسرار عشوائية، ثم يطبع قيم أسرار GitHub.
آمن لإعادة التشغيل: لا يستبدل شهادة موجودة ولا ملف `.env` موجوداً.

بعده يتبقى عليك خطوتان فقط: **المفتاح (قسم 4)** و **أسرار GitHub (قسم 5)**.

الأقسام التالية تشرح ما يفعله السكربت خطوة بخطوة — للمراجعة أو للتنفيذ اليدوي.

---

## 1. تجهيز السيرفر (مرة واحدة)

ادخل بالسيرفر: `ssh root@SERVER_IP`

### 1.1 تحديث النظام وتثبيت Docker

```sh
apt update && apt upgrade -y
apt install -y ca-certificates curl gnupg ufw

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker compose version   # تأكيد
```

> ملاحظة: Ubuntu 26.04 حديث جداً؛ لو ما توفر مستودع Docker لاسم الإصدار، استبدل `$VERSION_CODENAME` باسم إصدار LTS المدعوم (مثل `noble`).

### 1.2 الجدار الناري

فقط SSH و HTTP و HTTPS مفتوحة للعالم. كل الخدمات الأخرى (Postgres، Grafana، RabbitMQ…) تبقى داخل شبكة Compose الخاصة ولا تُنشر على المنافذ العامة.

```sh
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

### 1.3 مجلد النشر

الـ workflow ينسخ ملفات التشغيل إلى `/app`:

```sh
mkdir -p /app/infra
```

---

## 2. الدومين والشهادة (TLS)

### 2.1 DNS

من لوحة مزوّد الدومين أضف سجل `A` يشير إلى IP السيرفر:

| النوع | الاسم | القيمة |
| --- | --- | --- |
| A | `app` (أو `@`) | `SERVER_IP` |

تحقق: `dig +short app.example.com` يرجّع IP السيرفر.

### 2.2 إصدار الشهادة

قبل تشغيل الـ stack، المنفذ 80 فاضي، فنستخدم وضع `standalone`:

```sh
apt install -y certbot
certbot certonly --standalone -d app.example.com --agree-tos -m you@example.com --no-eff-email

ls -l /etc/letsencrypt/live/app.example.com/
# fullchain.pem و privkey.pem لازم يكونان موجودين
```

### 2.3 التجديد التلقائي

certbot يركّب مؤقّت تجديد تلقائياً، لكن التجديد يحتاج المنفذ 80 (يمسكه nginx بعد النشر)، ويحتاج إعادة تحميل nginx بعد التجديد:

```sh
mkdir -p /etc/letsencrypt/renewal-hooks/pre /etc/letsencrypt/renewal-hooks/post

cat > /etc/letsencrypt/renewal-hooks/pre/stop-nginx.sh <<'EOF'
#!/bin/sh
docker compose -f /app/docker-compose.prod.yml stop nginx || true
EOF

cat > /etc/letsencrypt/renewal-hooks/post/start-nginx.sh <<'EOF'
#!/bin/sh
docker compose -f /app/docker-compose.prod.yml start nginx || true
EOF

chmod +x /etc/letsencrypt/renewal-hooks/pre/stop-nginx.sh /etc/letsencrypt/renewal-hooks/post/start-nginx.sh
certbot renew --dry-run
```

---

## 3. ملف الأسرار على السيرفر

`docker compose` يقرأ `/app/.env` تلقائياً. أنشئه على السيرفر ولا ترفعه للـ git أبداً:

```sh
cat > /app/.env <<'EOF'
POSTGRES_PASSWORD=<كلمة سر عشوائية>
RABBITMQ_USER=ree-service
RABBITMQ_PASSWORD=<كلمة سر عشوائية>
JWT_SIGNING_KEY=<64 حرف على الأقل>
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=<كلمة سر عشوائية>
TLS_CERTIFICATE_PATH=/etc/letsencrypt/live/app.example.com/fullchain.pem
TLS_PRIVATE_KEY_PATH=/etc/letsencrypt/live/app.example.com/privkey.pem
PUBLIC_APP_URL=https://app.example.com
EOF

chmod 600 /app/.env
```

لتوليد القيم: `openssl rand -base64 48` (ولـ JWT: `openssl rand -base64 64`).

القالب المرجعي: `infra/production.env.example`.

---

## 4. مفتاح SSH للنشر

لا تستخدم مفتاحك الشخصي. أنشئ مفتاحاً مخصصاً للـ CI **من جهازك**:

```sh
ssh-keygen -t ed25519 -f ~/.ssh/hetzner_deploy -C "github-actions-deploy" -N ""
ssh-copy-id -i ~/.ssh/hetzner_deploy.pub root@SERVER_IP
ssh -i ~/.ssh/hetzner_deploy root@SERVER_IP "echo OK"
```

محتوى `~/.ssh/hetzner_deploy` (المفتاح الخاص، كامل مع سطري BEGIN/END) هو ما يوضع في السر `HETZNER_SSH_KEY`.

---

## 5. أسرار GitHub

من `Settings → Secrets and variables → Actions → New repository secret` في ريبو `BuadDigital/case_study`:

| السر | القيمة |
| --- | --- |
| `HETZNER_SSH_HOST` | IP السيرفر |
| `HETZNER_SSH_USER` | `root` |
| `HETZNER_SSH_KEY` | محتوى المفتاح الخاص `hetzner_deploy` |
| `HETZNER_SSH_PORT` | `22` |
| `TLS_CERTIFICATE_PATH` | `/etc/letsencrypt/live/app.example.com/fullchain.pem` |
| `TLS_PRIVATE_KEY_PATH` | `/etc/letsencrypt/live/app.example.com/privkey.pem` |
| `PUBLIC_APP_URL` | `https://app.example.com` |
| `GHCR_PAT` | Personal Access Token (classic) بصلاحية `read:packages` — يستخدمه السيرفر لسحب الصور من GHCR |
| `GHCR_USER` | اسم مستخدم GitHub **مالك** الـ PAT (اختياري؛ الافتراضي هو من عمل الـ push، وهذا يفشل لو دفع شخص آخر) |

`GHCR_PAT` يُنشأ من `github.com/settings/tokens` → Generate new token (classic) → اختر `read:packages` فقط.

> الصور تُنشر على `ghcr.io/buaddigital/case_study/*` وتكون **private** افتراضياً؛ لذلك السيرفر يحتاج الـ PAT. لو خليتها public تقدر تحذف الحاجة له.

---

## 6. تفعيل الـ workflow

الملف مفعّل الآن باسم `.github/workflows/deploy.yml` (كان `deploy.yml.disabled`). يكفي رفعه:

```sh
git add .github/workflows/deploy.yml
git commit -m "Enable Hetzner CI/CD pipeline"
git push origin main
```

⚠️ اضبط الأسرار في الخطوة 5 **قبل** الـ push، وإلا فشلت مرحلة النشر.

ما الذي يحدث عند كل `push` على `main`:

1. **test** — تثبيت الحزم، فحص أنواع الـ MFEs، اختبارات الواجهة، بناء واختبار الـ backend مع تغطية.
2. **build-and-push** — بناء 12 صورة (الواجهة + Gateway + 9 خدمات + أداة الهجرة) ورفعها إلى GHCR بوسمين: `latest` و `<sha>`.
3. **deploy** — نسخ ملفات Compose إلى `/app`، تسجيل الدخول لـ GHCR، `docker compose pull`، تشغيل `migrate` مرة واحدة، ثم `up -d`، ثم فحص صحة Gateway و Identity و Case Study، وأخيراً فحص HTTPS من الخارج.

الـ Pull Requests تشغّل **الاختبارات فقط** — لا بناء ولا نشر.

---

## 7. أول نشر

بعد الـ push، تابع من تبويب Actions. لو أردت تشغيله يدوياً: `Actions → CI/CD Pipeline → Run workflow`.

للتحقق من السيرفر:

```sh
cd /app
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f gateway frontend
curl -I https://app.example.com
```

---

## 8. تشغيل يدوي من السيرفر (بدون CI)

مفيد للتجربة أو عند تعطل الـ CI:

```sh
cd /app
export IMAGE_OWNER=buaddigital
export TAG=latest
docker login ghcr.io -u <username> --password <GHCR_PAT>
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml run --rm migrate
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

---

## 9. التراجع (Rollback)

كل إصدار موسوم بـ commit SHA والصور القديمة محفوظة:

```sh
cd /app
export IMAGE_OWNER=buaddigital
export TAG=<sha-الإصدار-السابق>
docker compose -f docker-compose.prod.yml up -d
```

---

## 10. الوصول للمراقبة (Grafana / Jaeger / RabbitMQ)

هذه الخدمات غير منشورة على الإنترنت عن قصد. ادخلها عبر نفق SSH:

```sh
ssh -L 3001:localhost:3000 root@SERVER_IP   # ثم افتح http://localhost:3001 لـ Grafana
```

لأن Grafana غير منشور على منفذ المضيف، استخدم بدلاً من ذلك:

```sh
docker compose -f /app/docker-compose.prod.yml port grafana 3000   # لو أضفت ports
# أو مؤقتاً:
ssh -L 3001:$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ree-prod-grafana):3000 root@SERVER_IP
```

---

## أخطاء شائعة

| العرض | السبب والحل |
| --- | --- |
| `deploy` يفشل عند `test -r "$TLS_CERTIFICATE_PATH"` | الشهادة غير موجودة أو المسار في الأسرار غلط. راجع الخطوة 2. |
| `denied` عند `docker compose pull` | `GHCR_PAT` منتهي أو بدون صلاحية `read:packages`. |
| حاويات تُقتل / `Exited (137)` | ذاكرة غير كافية. كبّر السيرفر أو أوقف حزمة المراقبة (`elasticsearch`، `jaeger`، `prometheus`، `grafana`). |
| `Set POSTGRES_PASSWORD` عند التشغيل | ملف `/app/.env` غير موجود أو ناقص. |
| الموقع يفتح لكن `/api` يرجّع 502 | Gateway لم يمر بفحص الصحة. `docker compose logs gateway identity`. |
