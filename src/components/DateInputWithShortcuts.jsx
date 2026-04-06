import { getTodayString, addDaysToToday } from '@/lib/dates';

// Input date con chips de atajo: Hoy / Mañana / Próx. semana / Sin fecha
export default function DateInputWithShortcuts({ value, onChange, minDate, allowPast = false }) {
  const today = getTodayString();
  const tomorrow = addDaysToToday(1);
  const nextWeek = addDaysToToday(7);

  return (
    <>
      <div className="date-shortcuts" role="group" aria-label="Atajos de fecha">
        <button
          type="button"
          className={`date-shortcut ${value === today ? 'active' : ''}`}
          onClick={() => onChange(today)}
        >
          Hoy
        </button>
        <button
          type="button"
          className={`date-shortcut ${value === tomorrow ? 'active' : ''}`}
          onClick={() => onChange(tomorrow)}
        >
          Mañana
        </button>
        <button
          type="button"
          className={`date-shortcut ${value === nextWeek ? 'active' : ''}`}
          onClick={() => onChange(nextWeek)}
        >
          Próx. semana
        </button>
        <button
          type="button"
          className={`date-shortcut ${!value ? 'active' : ''}`}
          onClick={() => onChange('')}
        >
          Sin fecha
        </button>
      </div>
      <input
        type="date"
        className="form-input"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        min={allowPast ? undefined : (minDate || today)}
      />
    </>
  );
}
