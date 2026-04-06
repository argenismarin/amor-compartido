import { formatDateDisplay } from '@/lib/dates';
import useFocusTrap from '@/hooks/useFocusTrap';

// Modal con la lista completa de logros y stats de gamificación.
//
// Props:
// - achievements: array de logros con { id, name, description, emoji, unlocked, unlocked_at }
// - streak: { current_streak, best_streak }
// - onClose: cerrar el modal
export default function AchievementsModal({ achievements, streak, onClose }) {
  const containerRef = useFocusTrap(onClose);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal achievements-modal"
        ref={containerRef}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h2 className="modal-title">🏆 Logros</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="achievements-list">
          {achievements.map(achievement => (
            <div
              key={achievement.id}
              className={`achievement-item ${achievement.unlocked ? 'unlocked' : 'locked'}`}
            >
              <span className="achievement-emoji">{achievement.emoji}</span>
              <div className="achievement-info">
                <div className="achievement-name">{achievement.name}</div>
                <div className="achievement-desc">{achievement.description}</div>
                {achievement.unlocked && (
                  <div className="achievement-date">
                    Desbloqueado el {formatDateDisplay(achievement.unlocked_at, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="achievements-stats">
          <div className="achievements-stat">
            <span className="achievements-stat-value">
              {achievements.filter(a => a.unlocked).length}/{achievements.length}
            </span>
            <span className="achievements-stat-label">Logros</span>
          </div>
          <div className="achievements-stat">
            <span className="achievements-stat-value">🔥 {streak.best_streak}</span>
            <span className="achievements-stat-label">Mejor racha</span>
          </div>
        </div>
      </div>
    </div>
  );
}
