// Wrapper de web-push: enviar notificaciones push a usuarios suscritos.
//
// Si las variables VAPID no están configuradas, las funciones loguean y no
// crashean — la app sigue funcionando, solo no llegan pushes hasta que se
// configuren las env vars.

import webpush from 'web-push';
import { query } from './db';

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:noreply@amorcompartido.app';

  if (!publicKey || !privateKey) {
    console.warn(
      '[push] VAPID keys no configuradas. Las notificaciones push no se enviarán. ' +
      'Generá keys con `npm run generate-vapid` y agregalas a .env.local y a Vercel.'
    );
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

/**
 * Envía una notificación push a todas las suscripciones de un usuario.
 * Limpia automáticamente las subscriptions inválidas (410 Gone).
 *
 * @param {number} userId - id del usuario destinatario
 * @param {object} payload - { title, body, url?, tag? }
 */
export async function sendPushToUser(userId, payload) {
  if (!ensureVapidConfigured()) return;
  if (!userId) return;

  try {
    const subscriptions = await query(
      'SELECT endpoint, p256dh, auth FROM AppChecklist_push_subscriptions WHERE user_id = $1',
      [userId]
    );

    if (!subscriptions || subscriptions.length === 0) return;

    const notificationPayload = JSON.stringify({
      title: payload.title || 'Amor Compartido 💕',
      body: payload.body || '',
      url: payload.url || '/',
      tag: payload.tag || 'amor-compartido',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    });

    await Promise.all(
      subscriptions.map(async (sub) => {
        const subscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };

        try {
          await webpush.sendNotification(subscription, notificationPayload);
        } catch (err) {
          // 410 Gone o 404: la suscripción ya no es válida, limpiarla
          if (err.statusCode === 410 || err.statusCode === 404) {
            await query(
              'DELETE FROM AppChecklist_push_subscriptions WHERE endpoint = $1',
              [sub.endpoint]
            ).catch(() => {});
          } else {
            console.error('[push] Error enviando notificación:', err.statusCode || err.message);
          }
        }
      })
    );
  } catch (error) {
    console.error('[push] Error en sendPushToUser:', error);
  }
}

/**
 * Devuelve la VAPID public key para que el cliente pueda hacer subscribe.
 * Útil para exponer desde un endpoint público.
 */
export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}
