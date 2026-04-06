// Modal de configuración: notificaciones, fechas especiales y stats.
//
// Props:
// - users: lista de usuarios para los cumpleaños
// - specialDates: lista de fechas especiales guardadas
// - mesiversarioInfo: { monthsTogether, daysTogether, daysUntilNext, ... }
// - streak: { current_streak, best_streak }
// - achievements: lista de logros con .unlocked
// - notificationsEnabled: bool
// - notificationPermission: 'default' | 'granted' | 'denied'
// - onEnableNotifications, onDisableNotifications: handlers de push
// - onSaveSpecialDate: (type, date, userId, label) => void
// - onClose: cerrar el modal
export default function SettingsModal({
  users,
  specialDates,
  mesiversarioInfo,
  streak,
  achievements,
  notificationsEnabled,
  notificationPermission,
  onEnableNotifications,
  onDisableNotifications,
  onSaveSpecialDate,
  onClose,
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">⚙️ Configuracion</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title">🔔 Notificaciones</h3>
          <p className="settings-section-desc">
            Recibe recordatorios de mesiversarios, logros y tareas de tu amor
          </p>
          <div className="notification-toggle">
            {notificationsEnabled ? (
              <button className="notification-btn enabled" onClick={onDisableNotifications}>
                🔔 Notificaciones activadas
              </button>
            ) : (
              <button className="notification-btn" onClick={onEnableNotifications}>
                🔕 Activar notificaciones
              </button>
            )}
            {notificationPermission === 'denied' && (
              <p className="notification-warning">
                ⚠️ Las notificaciones están bloqueadas. Habilítalas en la configuración de tu navegador.
              </p>
            )}
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title">💕 Fechas Especiales</h3>
          <p className="settings-section-desc">
            Configura fechas importantes para recibir celebraciones especiales
          </p>

          <div className="special-date-form">
            <label className="form-label">Aniversario de pareja</label>
            <input
              type="date"
              className="form-input"
              value={specialDates.find(d => d.type === 'anniversary')?.date?.split('T')[0] || ''}
              onChange={e => onSaveSpecialDate('anniversary', e.target.value, null, 'Aniversario')}
            />
          </div>

          {mesiversarioInfo && (
            <div className="mesiversario-info-box">
              <div className="mesiversario-info-stat">
                <span className="mesiversario-info-label">💕 Tiempo juntos:</span>
                <span className="mesiversario-info-value">{mesiversarioInfo.monthsTogether} meses ({mesiversarioInfo.daysTogether} días)</span>
              </div>
              {mesiversarioInfo.daysUntilNext > 0 && (
                <div className="mesiversario-info-stat">
                  <span className="mesiversario-info-label">📅 Próximo mesiversario:</span>
                  <span className="mesiversario-info-value">en {mesiversarioInfo.daysUntilNext} días</span>
                </div>
              )}
            </div>
          )}

          <div className="special-date-form">
            <label className="form-label">Cumpleaños de {users[0]?.name || 'Usuario 1'}</label>
            <input
              type="date"
              className="form-input"
              value={specialDates.find(d => d.type === 'birthday' && d.user_id === users[0]?.id)?.date?.split('T')[0] || ''}
              onChange={e => onSaveSpecialDate('birthday', e.target.value, users[0]?.id)}
            />
          </div>

          <div className="special-date-form">
            <label className="form-label">Cumpleaños de {users[1]?.name || 'Usuario 2'}</label>
            <input
              type="date"
              className="form-input"
              value={specialDates.find(d => d.type === 'birthday' && d.user_id === users[1]?.id)?.date?.split('T')[0] || ''}
              onChange={e => onSaveSpecialDate('birthday', e.target.value, users[1]?.id)}
            />
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title">📊 Estadísticas</h3>
          <div className="settings-stats">
            <div className="settings-stat">
              <span>🔥 Racha actual:</span>
              <strong>{streak.current_streak} días</strong>
            </div>
            <div className="settings-stat">
              <span>⭐ Mejor racha:</span>
              <strong>{streak.best_streak} días</strong>
            </div>
            <div className="settings-stat">
              <span>🏆 Logros:</span>
              <strong>{achievements.filter(a => a.unlocked).length}/{achievements.length}</strong>
            </div>
            {mesiversarioInfo && (
              <div className="settings-stat">
                <span>💕 Meses juntos:</span>
                <strong>{mesiversarioInfo.monthsTogether}</strong>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
