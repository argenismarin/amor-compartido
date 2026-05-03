import useFocusTrap from '@/hooks/useFocusTrap';

// Extrae YYYY-MM-DD de un valor de fecha (string ISO, "YYYY-MM-DD",
// o Date object devuelto por pg para columnas DATE). Antes hacia
// `value?.split('T')[0]` directamente lo que crasheaba con Date objects.
const toDateInputValue = (value) => {
  if (!value) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return (
      value.getFullYear() + '-' +
      String(value.getMonth() + 1).padStart(2, '0') + '-' +
      String(value.getDate()).padStart(2, '0')
    );
  }
  return String(value).split('T')[0];
};

// Modal de configuración: notificaciones, fechas especiales, stats y datos.
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
// - onExportData: () => void — descarga JSON con todos los datos
// - onImportData: (file: File) => void — importa desde un archivo JSON
// - theme: 'light' | 'dark' | 'auto' — preferencia actual
// - onSetTheme: (theme) => void — handler del picker
// - lang: 'es' | 'en' — idioma actual
// - onSetLang: (lang) => void — handler del picker de idioma
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
  onExportData,
  onImportData,
  theme,
  onSetTheme,
  lang,
  onSetLang,
  onClose,
}) {
  const containerRef = useFocusTrap(onClose);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal settings-modal"
        ref={containerRef}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
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
              value={toDateInputValue(specialDates.find(d => d.type === 'anniversary')?.date)}
              onChange={e => {
                // No mandar "" al endpoint (el schema lo rechaza con 400);
                // ignorar hasta que el user elija una fecha valida.
                if (e.target.value) onSaveSpecialDate('anniversary', e.target.value, null, 'Aniversario');
              }}
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
              value={toDateInputValue(specialDates.find(d => d.type === 'birthday' && d.user_id === users[0]?.id)?.date)}
              onChange={e => {
                if (e.target.value) onSaveSpecialDate('birthday', e.target.value, users[0]?.id);
              }}
            />
          </div>

          <div className="special-date-form">
            <label className="form-label">Cumpleaños de {users[1]?.name || 'Usuario 2'}</label>
            <input
              type="date"
              className="form-input"
              value={toDateInputValue(specialDates.find(d => d.type === 'birthday' && d.user_id === users[1]?.id)?.date)}
              onChange={e => {
                if (e.target.value) onSaveSpecialDate('birthday', e.target.value, users[1]?.id);
              }}
            />
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title">🎨 Tema</h3>
          <p className="settings-section-desc">
            Elige cómo se ve la app. &quot;Auto&quot; sigue tu preferencia del sistema.
          </p>
          <div className="theme-picker" role="radiogroup" aria-label="Selección de tema">
            {[
              { value: 'light', label: 'Claro', icon: '☀️' },
              { value: 'auto', label: 'Auto', icon: '🌓' },
              { value: 'dark', label: 'Oscuro', icon: '🌙' },
            ].map((opt) => (
              <button
                type="button"
                key={opt.value}
                role="radio"
                aria-checked={theme === opt.value}
                className={`theme-option ${theme === opt.value ? 'selected' : ''}`}
                onClick={() => onSetTheme?.(opt.value)}
              >
                <span className="theme-option-icon" aria-hidden="true">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title">🌐 Idioma</h3>
          <p className="settings-section-desc">
            Elige el idioma de la app.
          </p>
          <div className="theme-picker" role="radiogroup" aria-label="Selección de idioma">
            {[
              { value: 'es', label: 'Español', icon: '🇨🇴' },
              { value: 'en', label: 'English', icon: '🇬🇧' },
            ].map((opt) => (
              <button
                type="button"
                key={opt.value}
                role="radio"
                aria-checked={lang === opt.value}
                className={`theme-option ${lang === opt.value ? 'selected' : ''}`}
                onClick={() => onSetLang?.(opt.value)}
              >
                <span className="theme-option-icon" aria-hidden="true">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
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

        <div className="settings-section">
          <h3 className="settings-section-title">💾 Tus datos</h3>
          <p className="settings-section-desc">
            Descarga un backup completo de tus tareas, proyectos y fechas
            especiales. Podés restaurarlo en cualquier momento.
          </p>
          <div className="data-actions">
            <button
              type="button"
              className="data-btn data-btn-export"
              onClick={onExportData}
            >
              📥 Exportar datos
            </button>
            <label className="data-btn data-btn-import">
              📤 Importar datos
              <input
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onImportData(file);
                    e.target.value = '';
                  }
                }}
              />
            </label>
          </div>
          <p className="data-help">
            El import es <strong>aditivo</strong>: agrega todo lo del
            backup sin borrar lo existente. Los duplicados se pueden
            eliminar después.
          </p>
        </div>
      </div>
    </div>
  );
}
