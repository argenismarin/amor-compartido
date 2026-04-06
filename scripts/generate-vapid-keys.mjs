// Genera un par de VAPID keys para push notifications.
// Uso: npm run generate-vapid
//
// Copiá el output a tu .env.local y a las env vars de Vercel.

import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log('');
console.log('VAPID keys generadas. Agregá estas variables a tu .env.local');
console.log('y al panel de Environment Variables de Vercel:');
console.log('');
console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
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
