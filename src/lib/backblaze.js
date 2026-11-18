import { createHash } from 'node:crypto';
import https from 'node:https';

const state = globalThis[Symbol.for('lapakwu.backblaze')] ??= {};

function konfigurasi() {
  const keyId = process.env.Backblaze_keyID?.trim();
  const appKey = process.env.Backblaze_app_key?.trim();
  const bucketName = process.env.Backblaze_bucketName?.trim();
  if (!keyId || !appKey || !bucketName) {
    throw new Error('Backblaze_keyID, Backblaze_app_key, dan Backblaze_bucketName wajib dikonfigurasi di .env.local.');
  }
  return { keyId, appKey, bucketName };
}

function request(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers, family: 4, timeout: 15_000 }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode || 0, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error(`Backblaze request timed out: ${new URL(url).hostname}`), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function jsonResponse(responsePromise) {
  const response = await responsePromise;
  const data = JSON.parse(response.body.toString('utf8') || '{}');
  if (response.status < 200 || response.status >= 300) throw new Error(`Backblaze ${data.code || response.status}: ${data.message || 'Permintaan gagal.'}`);
  return data;
}

async function otorisasi() {
  const config = konfigurasi();
  if (!state.auth || state.auth.expiresAt < Date.now() + 60_000) {
    const basic = Buffer.from(`${config.keyId}:${config.appKey}`).toString('base64');
    const auth = await jsonResponse(request('https://api.backblazeb2.com/b2api/v4/b2_authorize_account', {
      headers: { Authorization: `Basic ${basic}` },
    }));
    const storageApi = auth.apiInfo?.storageApi || auth;
    state.auth = {
      ...auth,
      ...config,
      apiUrl: storageApi.apiUrl,
      downloadUrl: storageApi.downloadUrl,
      allowed: storageApi.allowed || auth.allowed,
      expiresAt: Date.now() + 23 * 60 * 60 * 1000,
    };
  }
  return state.auth;
}

async function bucketId(auth) {
  if (auth.allowed?.bucketId) return auth.allowed.bucketId;
  if (!state.bucketId || state.bucketName !== auth.bucketName) {
    const data = await jsonResponse(request(`${auth.apiUrl}/b2api/v4/b2_list_buckets`, {
      method: 'POST',
      headers: { Authorization: auth.authorizationToken, 'content-type': 'application/json' },
      body: JSON.stringify({ accountId: auth.accountId, bucketName: auth.bucketName }),
    }));
    state.bucketId = data.buckets?.find((bucket) => bucket.bucketName === auth.bucketName)?.bucketId;
    state.bucketName = auth.bucketName;
  }
  if (!state.bucketId) throw new Error(`Backblaze bucket tidak ditemukan: ${auth.bucketName}`);
  return state.bucketId;
}

async function uploadUrl(auth) {
  const id = await bucketId(auth);
  return jsonResponse(request(`${auth.apiUrl}/b2api/v4/b2_get_upload_url?bucketId=${encodeURIComponent(id)}`, {
    headers: { Authorization: auth.authorizationToken },
  }));
}

export async function unggahFile(name, buffer, contentType) {
  const auth = await otorisasi();
  const target = await uploadUrl(auth);
  const sha1 = createHash('sha1').update(buffer).digest('hex');
  const result = await jsonResponse(request(target.uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: target.authorizationToken,
      'X-Bz-File-Name': encodeURIComponent(name),
      'Content-Type': contentType || 'b2/x-auto',
      'Content-Length': String(buffer.length),
      'X-Bz-Content-Sha1': sha1,
    },
    body: buffer,
  }));
  return { id: result.fileId, name: result.fileName };
}

export async function unduhFile(name) {
  const auth = await otorisasi();
  const url = `${auth.downloadUrl}/file/${encodeURIComponent(auth.bucketName)}/${name.split('/').map(encodeURIComponent).join('/')}`;
  const response = await request(url, {
    headers: { Authorization: auth.authorizationToken },
  });
  if (response.status < 200 || response.status >= 300) {
    const data = JSON.parse(response.body.toString('utf8') || '{}');
    throw new Error(`Backblaze ${data.code || response.status}: ${data.message || 'File tidak ditemukan.'}`);
  }
  return response.body;
}

export async function hapusFile(name) {
  const auth = await otorisasi();
  const id = await bucketId(auth);
  const listed = await jsonResponse(request(`${auth.apiUrl}/b2api/v4/b2_list_file_versions`, {
    method: 'POST',
    headers: { Authorization: auth.authorizationToken, 'content-type': 'application/json' },
    body: JSON.stringify({ bucketId: id, startFileName: name, maxFileCount: 100 }),
  }));
  const versions = (listed.files || []).filter((file) => file.fileName === name);
  await Promise.all(versions.map((file) => jsonResponse(request(`${auth.apiUrl}/b2api/v4/b2_delete_file_version`, {
    method: 'POST',
    headers: { Authorization: auth.authorizationToken, 'content-type': 'application/json' },
    body: JSON.stringify({ fileId: file.fileId, fileName: file.fileName }),
  }))));
}
