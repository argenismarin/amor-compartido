// Genera un par de VAPID keys para push notifications.
// Uso: npm run generate-vapid
//
// Usa node:crypto nativo (sin depender de web-push) para evitar
// problemas en filesystems con archivos fantasma.
//
// Copiá el output a tu .env.local y a las env vars de Vercel.

import { generateKeyPairSync } from 'node:crypto';

// VAPID usa ECDSA P-256
const { publicKey, privateKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
});

// Exportar como JWK para extraer x, y, d en base64url
const pubJwk = publicKey.export({ format: 'jwk' });
const privJwk = privateKey.export({ format: 'jwk' });

// VAPID public key = punto sin comprimir: 0x04 || X || Y, en base64url
const xBuf = Buffer.from(pubJwk.x, 'base64url');
const yBuf = Buffer.from(pubJwk.y, 'base64url');
const publicKeyB64 = Buffer.concat([Buffer.from([0x04]), xBuf, yBuf]).toString('base64url');

// VAPID private key = scalar d (ya viene en base64url desde JWK)
const privateKeyB64 = privJwk.d;

console.log('');
console.log('VAPID keys generadas. Agregá estas variables a tu .env.local');
console.log('y al panel de Environment Variables de Vercel:');
console.log('');
console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY=' + publicKeyB64);
console.log('VAPID_PRIVATE_KEY=' + privateKeyB64);
console.log('VAPID_SUBJECT=mailto:tu-email@ejemplo.com');
console.log('');
console.log('Importante:');
console.log('- NEXT_PUBLIC_VAPID_PUBLIC_KEY se expone al cliente (es safe).');
console.log('- VAPID_PRIVATE_KEY es secreta, NUNCA la commitees.');
console.log('- VAPID_SUBJECT debe ser un mailto: o una URL.');
console.log('- Después de configurar las env vars, las suscripciones existentes');
console.log('  van a quedar obsoletas: los usuarios deben volver a activar');
console.log('  notificaciones en Settings (la public key cambió).');
console.log('');
