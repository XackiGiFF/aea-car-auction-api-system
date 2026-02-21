const express = require('express');
const helmet = require('helmet');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config();

const app = express();

const PORT = Number(process.env.PORT || 3010);
const NODE_ENV = process.env.NODE_ENV || 'production';
const MEDIA_ROOT = process.env.MEDIA_ROOT || '/app/media';
const MEDIA_ACCESS_TOKEN = process.env.MEDIA_ACCESS_TOKEN || '';
const MEDIA_PUBLIC_BASE_URL = (process.env.MEDIA_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
const MEDIA_ALLOWED_HOSTS = String(process.env.MEDIA_ALLOWED_HOSTS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
const MEDIA_SOURCE_REFERER = process.env.MEDIA_SOURCE_REFERER || 'https://www.che168.com/';
const MEDIA_SOURCE_USER_AGENT = process.env.MEDIA_SOURCE_USER_AGENT || 'Mozilla/5.0';
const MEDIA_TIMEOUT_MS = Number(process.env.MEDIA_TIMEOUT_MS || 25000);
const MEDIA_MAX_BYTES = Number(process.env.MEDIA_MAX_BYTES || 20 * 1024 * 1024);

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(express.json({ limit: '512kb' }));
app.use('/cdn/media', express.static(MEDIA_ROOT, {
    fallthrough: false,
    index: false,
    etag: true,
    maxAge: NODE_ENV === 'production' ? '7d' : 0
}));

function log(message, data = null) {
    const ts = new Date().toISOString();
    console.log(`[CDN-MEDIA][${ts}] ${message}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
}

function sanitizeSegment(value, fallback) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || fallback;
}

function buildTargetRelativePath({ provider, brand, model, carId, index, ext }) {
    const providerSeg = sanitizeSegment(provider, 'unknown-provider');
    const brandSeg = sanitizeSegment(brand, 'unknown-brand');
    const modelSeg = sanitizeSegment(model, 'unknown-model');
    const carSeg = sanitizeSegment(carId, crypto.createHash('md5').update(String(carId || Date.now())).digest('hex').slice(0, 12));
    const fileName = `${String(index).padStart(2, '0')}${ext}`;
    return path.posix.join(providerSeg, brandSeg, modelSeg, carSeg, fileName);
}

function detectExt(sourceUrl, contentType) {
    const urlLower = String(sourceUrl || '').toLowerCase();
    const ct = String(contentType || '').toLowerCase();
    if (ct.includes('webp') || urlLower.includes('.webp')) return '.webp';
    if (ct.includes('png') || urlLower.includes('.png')) return '.png';
    if (ct.includes('jpeg') || ct.includes('jpg') || urlLower.includes('.jpg') || urlLower.includes('.jpeg')) return '.jpg';
    if (ct.includes('gif') || urlLower.includes('.gif')) return '.gif';
    return '.jpg';
}

function validateSourceUrl(sourceUrl) {
    let parsed;
    try {
        parsed = new URL(sourceUrl);
    } catch (error) {
        return { ok: false, reason: 'Invalid source_url' };
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { ok: false, reason: 'Only http/https source URLs are allowed' };
    }

    if (MEDIA_ALLOWED_HOSTS.length > 0 && !MEDIA_ALLOWED_HOSTS.includes(parsed.hostname.toLowerCase())) {
        return { ok: false, reason: `Host not allowed: ${parsed.hostname}` };
    }

    return { ok: true, parsed };
}

async function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
}

function requireToken(req, res, next) {
    if (!MEDIA_ACCESS_TOKEN) {
        return res.status(500).json({ ok: false, error: 'MEDIA_ACCESS_TOKEN is not configured' });
    }

    const provided = String(req.headers['x-media-token'] || '');
    if (!provided || provided !== MEDIA_ACCESS_TOKEN) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    next();
}

app.get('/health', async (req, res) => {
    res.json({
        ok: true,
        service: 'cdn-media-bot',
        node_env: NODE_ENV
    });
});

app.post('/internal/media/fetch', requireToken, async (req, res) => {
    const sourceUrl = String(req.body?.source_url || '').trim();
    const provider = String(req.body?.provider || 'unknown').trim();
    const brand = String(req.body?.brand || '').trim();
    const model = String(req.body?.model || '').trim();
    const carId = String(req.body?.car_id || '').trim();
    const imageIndex = Number(req.body?.image_index || 1);

    if (!sourceUrl) {
        return res.status(400).json({ ok: false, error: 'source_url is required' });
    }

    if (!MEDIA_PUBLIC_BASE_URL) {
        return res.status(500).json({ ok: false, error: 'MEDIA_PUBLIC_BASE_URL is not configured' });
    }

    const validated = validateSourceUrl(sourceUrl);
    if (!validated.ok) {
        return res.status(400).json({ ok: false, error: validated.reason });
    }

    try {
        const headResp = await axios.get(sourceUrl, {
            timeout: MEDIA_TIMEOUT_MS,
            responseType: 'arraybuffer',
            maxContentLength: MEDIA_MAX_BYTES,
            headers: {
                'User-Agent': MEDIA_SOURCE_USER_AGENT,
                'Referer': MEDIA_SOURCE_REFERER,
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
            }
        });

        const ext = detectExt(sourceUrl, headResp.headers['content-type']);
        const relPath = buildTargetRelativePath({
            provider,
            brand,
            model,
            carId,
            index: Number.isFinite(imageIndex) && imageIndex > 0 ? imageIndex : 1,
            ext
        });

        const absPath = path.join(MEDIA_ROOT, relPath);
        const publicUrl = `${MEDIA_PUBLIC_BASE_URL}/${relPath}`.replace(/\\/g, '/');

        try {
            await fs.access(absPath);
            return res.json({ ok: true, url: publicUrl, cached: true });
        } catch (_) {
            // continue
        }

        await ensureDir(absPath);
        await fs.writeFile(absPath, headResp.data);

        log('Media saved', { sourceUrl, relPath });
        return res.json({ ok: true, url: publicUrl, cached: false });
    } catch (error) {
        log(`Fetch failed: ${error.message}`, { sourceUrl });
        return res.status(502).json({ ok: false, error: 'Failed to fetch source image' });
    }
});

app.listen(PORT, () => {
    log(`Service started on :${PORT}`);
});
