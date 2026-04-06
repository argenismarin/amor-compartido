// Overlay con todos los efectos visuales de celebración:
// floating hearts, confetti, banner y modal de logro nuevo.
//
// Props:
// - floatingHearts: array de { id, emoji, left, delay }
// - confetti: array de { id, left, delay, shape, size }
// - celebrationBanner: { text, subtext } o null
// - newAchievement: { emoji, name, description } o null
export default function CelebrationOverlay({
  floatingHearts,
  confetti,
  celebrationBanner,
  newAchievement,
}) {
  return (
    <>
      {floatingHearts.length > 0 && (
        <div className="hearts-container" aria-hidden="true">
          {floatingHearts.map(heart => (
            <span
              key={heart.id}
              className="floating-heart"
              style={{
                left: `${heart.left}%`,
                bottom: '20%',
                animationDelay: `${heart.delay}s`,
              }}
            >
              {heart.emoji}
            </span>
          ))}
        </div>
      )}

      {confetti.length > 0 && (
        <div className="confetti-container" aria-hidden="true">
          {confetti.map(piece => (
            <div
              key={piece.id}
              className={`confetti ${piece.shape}`}
              style={{
                left: `${piece.left}%`,
                top: '-20px',
                width: piece.shape !== 'heart' ? `${piece.size}px` : 'auto',
                height: piece.shape !== 'heart' ? `${piece.size}px` : 'auto',
                animationDelay: `${piece.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {celebrationBanner && (
        <div className="celebration-banner" role="alert" aria-live="polite">
          <div className="celebration-banner-text">{celebrationBanner.text}</div>
          <div className="celebration-banner-subtext">{celebrationBanner.subtext}</div>
        </div>
      )}

      {newAchievement && (
        <div className="achievement-unlock-overlay">
          <div className="achievement-unlock-modal">
            <div className="achievement-unlock-emoji">{newAchievement.emoji}</div>
            <div className="achievement-unlock-title">¡Logro desbloqueado!</div>
            <div className="achievement-unlock-name">{newAchievement.name}</div>
            <div className="achievement-unlock-desc">{newAchievement.description}</div>
          </div>
        </div>
      )}
    </>
  );
}
