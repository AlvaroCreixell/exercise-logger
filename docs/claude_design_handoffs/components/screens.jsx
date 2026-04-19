// Exercise Logger — screen components

const C = {
  paper: 'var(--paper)',
  ink: 'var(--ink)',
  ink2: 'var(--ink-2)',
  ink3: 'var(--ink-3)',
  line: 'var(--line)',
  lineSoft: 'var(--line-soft)',
  sage: 'var(--sage)',
  sageSoft: 'var(--sage-soft)',
  sageDeep: 'var(--sage-deep)',
  warm: 'var(--warm)',
  card: 'var(--card)',
  danger: 'var(--danger)',
};

// ──────────────────────────────────────────────────────────
// ICONS — minimal line icons
// ──────────────────────────────────────────────────────────
const Icon = {
  chev: (d = 'right') => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {d === 'right' && <polyline points="9 18 15 12 9 6" />}
      {d === 'left' && <polyline points="15 18 9 12 15 6" />}
      {d === 'down' && <polyline points="6 9 12 15 18 9" />}
      {d === 'up' && <polyline points="18 15 12 9 6 15" />}
    </svg>
  ),
  plus: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  play: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 21 12 6 21 6 3" /></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  flame: <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/></svg>,
  dumb: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/></svg>,
  cal: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>,
  history: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>,
  gear: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  x: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  back: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  del: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  sparkle: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3z"/></svg>,
  timer: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>,
};

// ──────────────────────────────────────────────────────────
// EYEBROW — tiny section label
// ──────────────────────────────────────────────────────────
function Eyebrow({ children, color, style }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 600, letterSpacing: '0.18em',
      textTransform: 'uppercase', color: color || C.ink3,
      fontFamily: 'Inter, sans-serif',
      ...style,
    }}>{children}</div>
  );
}

// ──────────────────────────────────────────────────────────
// APP SHELL — status bar + content + bottom tab bar
// ──────────────────────────────────────────────────────────
function AppShell({ tab, onTab, children, time = '9:41' }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: C.paper, display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: C.ink, position: 'relative',
    }}>
      {/* Status bar */}
      <div style={{
        height: 36, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 20px',
        fontSize: 13, fontWeight: 600, letterSpacing: 0.2,
        fontFeatureSettings: '"tnum"',
        color: C.ink,
      }}>
        <span>{time}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 16, height: 10, borderRadius: 2, border: `1.2px solid ${C.ink}`, position: 'relative' }}>
            <div style={{ position: 'absolute', right: -3, top: 2, width: 2, height: 4, background: C.ink, borderRadius: 1 }} />
            <div style={{ position: 'absolute', inset: 1.5, background: C.ink, borderRadius: 1, width: '70%' }} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>

      {/* Bottom tab bar */}
      <div style={{
        borderTop: `1px solid ${C.line}`,
        background: C.paper,
        paddingBottom: 18,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '10px 0 6px' }}>
          {[
            { id: 'today', label: 'Today', icon: Icon.cal },
            { id: 'workout', label: 'Workout', icon: Icon.dumb },
            { id: 'history', label: 'History', icon: Icon.history },
            { id: 'settings', label: 'Settings', icon: Icon.gear },
          ].map(t => (
            <button key={t.id} onClick={() => onTab(t.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: tab === t.id ? C.ink : C.ink3,
                padding: '4px 12px', fontFamily: 'inherit',
              }}>
              <span style={{ opacity: tab === t.id ? 1 : 0.75 }}>{t.icon}</span>
              <span style={{ fontSize: 10.5, fontWeight: tab === t.id ? 600 : 500, letterSpacing: 0.2 }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// TODAY SCREEN
// ──────────────────────────────────────────────────────────
function TodayScreen({ state, onStart, onResume, onSelectDay }) {
  const { routine, activeSession, selectedDayId, sessionsThisWeek, lastSession } = state;
  const day = routine.days[selectedDayId];
  const firstTwo = day.entries.slice(0, 2).map(e => e.kind === 'exercise' ? e.name : e.items[0].name);
  const bodyParts = day.bodyParts || [];
  const estMin = Math.max(10, Math.ceil(day.totalSets * 2 / 5) * 5);

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ padding: '18px 22px 8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <Eyebrow>Sunday · Apr 19</Eyebrow>
            <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 30, lineHeight: 1.12, marginTop: 6, letterSpacing: '-0.01em', textWrap: 'balance' }}>
              Good morning, <span style={{ fontStyle: 'italic' }}>Álvaro</span>.
            </div>
          </div>
        </div>
        {sessionsThisWeek >= 2 && (
          <div style={{
            marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '5px 10px 5px 9px', borderRadius: 999,
            background: C.sageSoft, color: C.sageDeep,
            fontSize: 11, fontWeight: 600, letterSpacing: 0.2,
          }}>
            <span style={{ color: C.warm }}>{Icon.flame}</span>
            {sessionsThisWeek} sessions this week
          </div>
        )}
      </div>

      {activeSession ? (
        // Resume card
        <div style={{ padding: '12px 18px 0' }}>
          <button onClick={onResume} style={{
            width: '100%', textAlign: 'left', cursor: 'pointer',
            background: C.sage, color: C.paper,
            border: 'none', borderRadius: 22, padding: 22,
            fontFamily: 'inherit',
          }}>
            <Eyebrow color="rgba(255,255,255,0.65)">In progress · 34 min</Eyebrow>
            <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 30, lineHeight: 1.05, marginTop: 8, letterSpacing: '-0.01em' }}>
              Resume workout
            </div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 6 }}>
              {activeSession.day} · {activeSession.logged}/{activeSession.total} sets
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginTop: 18,
              fontSize: 13, fontWeight: 600,
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: 'rgba(255,255,255,0.2)' }}>{Icon.play}</span>
              Continue
            </div>
          </button>
        </div>
      ) : (
        // Hero card — today's workout
        <div style={{ padding: '12px 18px 0' }}>
          <div style={{
            borderRadius: 24, padding: '22px 22px 20px',
            background: C.card,
            border: `1px solid ${C.lineSoft}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Eyebrow>Today · Day {selectedDayId}</Eyebrow>
              <div style={{ fontSize: 11, color: C.ink3, fontFeatureSettings: '"tnum"' }}>~{estMin} min</div>
            </div>
            <div style={{
              fontFamily: 'Instrument Serif, serif', fontSize: 30,
              lineHeight: 1.08, marginTop: 10,
              letterSpacing: '-0.01em', textWrap: 'balance',
            }}>
              {day.label}
            </div>

            <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {bodyParts.map((bp, i) => (
                <span key={i} style={{
                  fontSize: 11.5, fontWeight: 500, padding: '5px 10px',
                  borderRadius: 999, background: C.paper,
                  border: `1px solid ${C.line}`, color: C.ink2,
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}>
                  {bp.primary && <span style={{ width: 5, height: 5, borderRadius: 999, background: C.sage }} />}
                  {bp.name}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 11.5, color: C.ink3, fontFeatureSettings: '"tnum"' }}>
              {day.totalExercises} exercises · {day.totalSets} sets · first up: {firstTwo[0]}
            </div>

            <button onClick={onStart} style={{
              marginTop: 20, width: '100%',
              background: C.ink, color: C.paper,
              border: 'none', borderRadius: 14,
              padding: '16px', fontSize: 15, fontWeight: 600,
              letterSpacing: 0.1, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              fontFamily: 'inherit',
            }}>
              <span style={{ fontSize: 12 }}>{Icon.play}</span>
              Start workout
            </button>
          </div>
        </div>
      )}

      {/* Switch day */}
      <div style={{ padding: '26px 22px 0' }}>
        <Eyebrow>Switch day</Eyebrow>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {routine.dayOrder.map(id => {
            const isNext = id === routine.nextDayId;
            const isSel = id === selectedDayId;
            return (
              <button key={id} onClick={() => onSelectDay(id)} style={{
                flex: 1, padding: '14px 8px', borderRadius: 14,
                border: `1px solid ${isSel ? C.ink : C.line}`,
                background: isSel ? C.ink : 'transparent',
                color: isSel ? C.paper : C.ink,
                cursor: 'pointer', fontFamily: 'inherit',
                textAlign: 'left', position: 'relative',
              }}>
                <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 24, lineHeight: 1 }}>{id}</div>
                <div style={{ fontSize: 10.5, color: isSel ? 'rgba(255,255,255,0.7)' : C.ink3, marginTop: 6, letterSpacing: 0.2 }}>
                  {isNext ? 'NEXT UP' : routine.days[id].shortLabel}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Last session */}
      {lastSession && (
        <div style={{ padding: '26px 22px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Eyebrow>Last session</Eyebrow>
            <span style={{ fontSize: 11, color: C.ink3 }}>{lastSession.relative}</span>
          </div>
          <div style={{
            marginTop: 10, padding: '16px 18px',
            borderRadius: 18, background: C.card,
            border: `1px solid ${C.lineSoft}`,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{lastSession.label}</div>
            <div style={{ display: 'flex', gap: 22, marginTop: 10 }}>
              {lastSession.stats.map((s, i) => (
                <div key={i}>
                  <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 26, lineHeight: 1, fontFeatureSettings: '"tnum"' }}>{s.v}</div>
                  <div style={{ fontSize: 10, color: C.ink3, letterSpacing: 0.3, marginTop: 4, textTransform: 'uppercase' }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// WORKOUT SCREEN
// ──────────────────────────────────────────────────────────
function WorkoutScreen({ state, onSetTap, onOpenPicker, onFinish, onDiscard }) {
  const { activeSession, exercises } = state;
  const logged = activeSession.logged;
  const total = activeSession.total;
  const pct = total > 0 ? Math.round(logged / total * 100) : 0;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Sticky header */}
      <div style={{
        padding: '14px 20px 14px',
        borderBottom: `1px solid ${C.lineSoft}`,
        background: C.paper,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Eyebrow color={C.sageDeep}>Day {activeSession.dayId} · 34:08 elapsed</Eyebrow>
            <div style={{
              fontFamily: 'Instrument Serif, serif', fontSize: 22,
              marginTop: 4, lineHeight: 1.15, letterSpacing: '-0.005em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {activeSession.day}
            </div>
          </div>
          <button onClick={onDiscard} style={{ background: 'transparent', border: 'none', color: C.ink3, cursor: 'pointer', padding: 6, marginRight: -6, marginTop: -2 }}>
            {Icon.x}
          </button>
        </div>

        {/* Progress bar + stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 4, background: C.lineSoft, overflow: 'hidden' }}>
            <div style={{ width: pct + '%', height: '100%', background: C.sage, transition: 'width .4s ease' }} />
          </div>
          <div style={{ fontSize: 12, fontFeatureSettings: '"tnum"', color: C.ink2, fontWeight: 600 }}>
            {logged}<span style={{ color: C.ink3, fontWeight: 500 }}>/{total}</span>
          </div>
        </div>
      </div>

      {/* Scrollable exercise list */}
      <div data-density="screen" style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 24px' }}>
        {exercises.map((ex, i) => (
          <ExerciseCard key={ex.id} ex={ex} onSetTap={(bi, si) => onSetTap(ex.id, bi, si)} index={i} />
        ))}

        <button onClick={onOpenPicker} style={{
          width: '100%', marginTop: 10,
          padding: '14px', borderRadius: 14,
          border: `1.5px dashed ${C.line}`,
          background: 'transparent', color: C.ink2,
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {Icon.plus} Add extra exercise
        </button>
      </div>

      {/* Footer */}
      <div style={{
        borderTop: `1px solid ${C.lineSoft}`,
        padding: '12px 18px', background: C.paper,
      }}>
        <button onClick={onFinish} style={{
          width: '100%', padding: '14px',
          background: C.ink, color: C.paper, border: 'none',
          borderRadius: 14, fontSize: 14, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {Icon.check} Finish workout
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// EXERCISE CARD (Workout screen)
// ──────────────────────────────────────────────────────────
function ExerciseCard({ ex, onSetTap, index }) {
  const isSuperset = ex.kind === 'superset';

  if (isSuperset) {
    return (
      <div data-density="card" style={{
        borderRadius: 18, background: C.card,
        border: `1px solid ${C.lineSoft}`,
        marginBottom: 12, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 12, bottom: 12, width: 3,
          background: C.warm, borderRadius: 4,
        }} />
        <div style={{ padding: '10px 16px 8px 18px' }}>
          <Eyebrow color={C.warm} style={{ fontSize: 9.5 }}>SUPERSET · A+B</Eyebrow>
        </div>
        {ex.items.map((item, i) => (
          <div key={i} style={{
            padding: '6px 16px 14px 18px',
            borderTop: i > 0 ? `1px dashed ${C.line}` : 'none',
          }}>
            <ExerciseBody ex={item} onSetTap={onSetTap} letter={['A', 'B'][i]} blockOffset={i} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div data-density="card" style={{
      borderRadius: 18, background: C.card,
      border: `1px solid ${C.lineSoft}`,
      padding: '16px 18px',
      marginBottom: 12,
    }}>
      <ExerciseBody ex={ex} onSetTap={onSetTap} />
    </div>
  );
}

function ExerciseBody({ ex, onSetTap, letter, blockOffset = 0 }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          {letter && (
            <span style={{
              fontFamily: 'Instrument Serif, serif', fontStyle: 'italic',
              fontSize: 18, color: C.warm, width: 12,
            }}>{letter}</span>
          )}
          <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.005em' }}>{ex.name}</div>
        </div>
        <div style={{ fontSize: 11, color: C.ink3, fontFeatureSettings: '"tnum"', whiteSpace: 'nowrap' }}>
          {ex.done}/{ex.sets.length}
        </div>
      </div>

      {ex.target && (
        <div style={{ fontSize: 11.5, color: C.ink3, marginTop: 3 }}>
          {ex.target}{ex.note ? ' · ' + ex.note : ''}
        </div>
      )}

      {/* Set rows */}
      <div data-density="sets" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ex.sets.map((s, si) => (
          <SetRow key={si} s={s} si={si} unit={ex.unit || 'kg'} onTap={() => onSetTap(blockOffset, si)} />
        ))}
      </div>

      {ex.lastTime && (
        <div style={{ marginTop: 10, fontSize: 10.5, color: C.ink3, display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ letterSpacing: 0.2, textTransform: 'uppercase', fontWeight: 600 }}>Last</span>
          <span style={{ color: C.ink2, fontFeatureSettings: '"tnum"' }}>{ex.lastTime}</span>
        </div>
      )}
    </div>
  );
}

function SetRow({ s, si, unit = 'kg', onTap }) {
  const done = !!s.weight || !!s.reps || s.done;
  const tag = s.tag;

  return (
    <button data-density="row" onClick={onTap} style={{
      display: 'grid', gridTemplateColumns: '28px 1fr auto', alignItems: 'center',
      padding: '10px 12px', borderRadius: 10,
      border: `1px solid ${done ? 'transparent' : C.line}`,
      background: done ? C.sageSoft : 'transparent',
      cursor: 'pointer', fontFamily: 'inherit',
      textAlign: 'left', width: '100%',
      transition: 'background .2s',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, borderRadius: 999,
        background: done ? C.sageDeep : 'transparent',
        border: done ? 'none' : `1.5px solid ${C.line}`,
        color: done ? C.paper : C.ink3,
        fontSize: 10, fontWeight: 700, fontFeatureSettings: '"tnum"',
      }}>
        {done ? Icon.check : si + 1}
      </div>
      <div style={{ paddingLeft: 10 }}>
        {done ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{
              fontFamily: 'Instrument Serif, serif', fontSize: 22,
              lineHeight: 1, fontFeatureSettings: '"tnum"', letterSpacing: '-0.01em',
            }}>
              {s.weight}
              <span style={{ fontSize: 11, color: C.ink3, fontFamily: 'Inter', marginLeft: 2 }}>{unit}</span>
            </span>
            <span style={{ fontSize: 13, color: C.ink3 }}>×</span>
            <span style={{
              fontFamily: 'Instrument Serif, serif', fontSize: 22,
              lineHeight: 1, fontFeatureSettings: '"tnum"',
            }}>{s.reps}</span>
            {tag && <span style={{ marginLeft: 4, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, color: C.warm, textTransform: 'uppercase' }}>{tag}</span>}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12.5, color: C.ink3 }}>Tap to log</span>
            {s.prev && <span style={{ fontSize: 10.5, color: C.ink3, fontFeatureSettings: '"tnum"' }}>· last {s.prev}</span>}
            {tag && <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, color: C.warm, textTransform: 'uppercase' }}>{tag}</span>}
          </div>
        )}
      </div>
      <div style={{ color: done ? C.sageDeep : C.ink3, fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }}>
        {done && s.progression === 'up' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>↑ PR</span>}
      </div>
    </button>
  );
}

// ──────────────────────────────────────────────────────────
// SET LOG SHEET (bottom sheet with custom keypad)
// ──────────────────────────────────────────────────────────
function SetLogSheet({ open, onClose, target, onSave, onToggleUnit, lastTime, suggestion }) {
  const [weight, setWeight] = React.useState(target?.weight ? String(target.weight) : (suggestion?.weight ? String(suggestion.weight) : ''));
  const [reps, setReps] = React.useState(target?.reps ? String(target.reps) : '');
  const [activeField, setActiveField] = React.useState('weight');
  const [pulse, setPulse] = React.useState(false);
  const [advancing, setAdvancing] = React.useState(false);

  React.useEffect(() => {
    if (open && target) {
      setWeight(target.weight ? String(target.weight) : (suggestion?.weight ? String(suggestion.weight) : ''));
      setReps(target.reps ? String(target.reps) : '');
      setActiveField('weight');
      // Flash "advanced" badge when the sheet rotates to a new set index > 0
      if (target.setIndex > 0 && target.autoAdvanced) {
        setAdvancing(true);
        setTimeout(() => setAdvancing(false), 1400);
      }
    }
  }, [open, target?.exId, target?.setIndex]);

  if (!open || !target) return null;

  const key = (v) => {
    const cur = activeField === 'weight' ? weight : reps;
    const setter = activeField === 'weight' ? setWeight : setReps;
    if (v === 'del') { setter(cur.slice(0, -1)); return; }
    if (v === '.' && cur.includes('.')) return;
    if (v === '.' && activeField === 'reps') return;
    if (cur === '0' && v !== '.') { setter(v); return; }
    setter(cur + v);
  };
  const nudge = (delta) => {
    const setter = activeField === 'weight' ? setWeight : setReps;
    const cur = activeField === 'weight' ? weight : reps;
    const n = parseFloat(cur || '0') + delta;
    setter(String(Math.max(0, +n.toFixed(2))));
  };

  const save = () => {
    setPulse(true);
    setTimeout(() => {
      onSave({ weight: parseFloat(weight) || 0, reps: parseInt(reps, 10) || 0 });
      setPulse(false);
    }, 280);
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(20, 18, 14, 0.38)',
        animation: 'fadeIn .25s ease', zIndex: 40,
      }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 50,
        background: C.paper, borderRadius: '26px 26px 0 0',
        padding: '10px 0 14px',
        animation: 'slideUp .32s cubic-bezier(.2,.9,.3,1)',
        boxShadow: '0 -20px 60px rgba(20,18,14,0.12)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 4 }}>
          <div style={{ width: 42, height: 4, borderRadius: 3, background: C.line }} />
        </div>

        {/* Header */}
        <div style={{ padding: '6px 22px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ position: 'relative' }}>
              <Eyebrow>
                {target.blockLabel} · Set {target.setIndex + 1}/{target.totalSets}
                {advancing && (
                  <span style={{
                    marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 7px', borderRadius: 999,
                    background: C.sageSoft, color: C.sageDeep,
                    fontSize: 9.5, letterSpacing: 0.3,
                    animation: 'fadeIn .2s ease',
                  }}>
                    ↓ advanced
                  </span>
                )}
              </Eyebrow>
              <div style={{
                fontFamily: 'Instrument Serif, serif', fontSize: 22, lineHeight: 1.1,
                marginTop: 4, letterSpacing: '-0.005em',
                transition: 'opacity .2s',
                opacity: advancing ? 0.6 : 1,
              }}>
                {target.name}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, marginTop: 2 }}>
              <div style={{
                fontSize: 9.5, color: C.ink3, letterSpacing: 0.4,
                textTransform: 'uppercase', fontWeight: 700,
                fontFeatureSettings: '"tnum"',
              }}>
                {target.setIndex + 1} of {target.totalSets}
              </div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {Array.from({ length: target.totalSets }).map((_, i) => {
                  const isDone = i < target.setIndex;
                  const isCurrent = i === target.setIndex;
                  return (
                    <div key={i} style={{
                      width: isCurrent ? 22 : 18, height: 18, borderRadius: 999,
                      background: isDone ? C.sage : (isCurrent ? C.ink : 'transparent'),
                      border: isDone ? 'none' : (isCurrent ? 'none' : `1.5px solid ${C.line}`),
                      color: isDone ? C.paper : (isCurrent ? C.paper : C.ink3),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, fontFamily: 'Inter, sans-serif',
                      fontFeatureSettings: '"tnum"',
                      transition: 'all .2s',
                      boxShadow: isCurrent ? `0 0 0 3px ${C.sageSoft}` : 'none',
                    }}>
                      {isDone ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Context: last + suggestion */}
          <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 11.5, fontFeatureSettings: '"tnum"' }}>
            {lastTime && (
              <div>
                <span style={{ color: C.ink3, letterSpacing: 0.3, textTransform: 'uppercase', fontSize: 10, fontWeight: 600 }}>Last  </span>
                <span style={{ color: C.ink2 }}>{lastTime}</span>
              </div>
            )}
            {suggestion && (
              <div style={{ color: C.sageDeep }}>
                <span style={{ letterSpacing: 0.3, textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>Suggested  </span>
                <span style={{ fontWeight: 600 }}>{suggestion.weight}{target.unit || 'kg'} ↑</span>
              </div>
            )}
          </div>
        </div>

        {/* Big values */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '18px 22px 10px' }}>
          <ValueBox
            label={`Weight (${target.unit || 'kg'})`}
            value={weight}
            active={activeField === 'weight'}
            onClick={() => setActiveField('weight')}
            onNudge={nudge}
            nudgeStep={2.5}
            pulse={pulse}
            unit={target.unit || 'kg'}
            onToggleUnit={onToggleUnit}
          />
          <ValueBox
            label="Reps"
            value={reps}
            active={activeField === 'reps'}
            onClick={() => setActiveField('reps')}
            onNudge={nudge}
            nudgeStep={1}
            integer
            pulse={pulse}
          />
        </div>

        {/* Keypad */}
        <div style={{ padding: '6px 14px 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {['1','2','3','4','5','6','7','8','9','.','0','del'].map((k, i) => (
            <button key={i} onClick={() => key(k)} style={{
              padding: '14px 0', fontSize: 20,
              fontFamily: 'Instrument Serif, serif', fontFeatureSettings: '"tnum"',
              background: 'transparent', border: `1px solid ${C.line}`,
              borderRadius: 12, cursor: 'pointer',
              color: C.ink,
            }}>
              {k === 'del' ? <span style={{ fontSize: 14, color: C.ink2 }}>⌫</span> : k}
            </button>
          ))}
        </div>

        <div style={{ padding: '12px 18px 2px' }}>
          <button onClick={save} style={{
            width: '100%', padding: '16px',
            background: C.ink, color: C.paper, border: 'none',
            borderRadius: 14, fontSize: 15, fontWeight: 600,
            fontFamily: 'inherit', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transform: pulse ? 'scale(0.98)' : 'scale(1)',
            transition: 'transform .2s',
          }}>
            {Icon.check} Save set
          </button>
        </div>
      </div>
    </>
  );
}

function ValueBox({ label, value, active, onClick, onNudge, nudgeStep, integer, pulse, unit, onToggleUnit }) {
  return (
    <div onClick={onClick} style={{
      border: `1.5px solid ${active ? C.ink : C.line}`,
      borderRadius: 16, padding: '12px 14px 10px',
      background: active ? C.card : 'transparent',
      cursor: 'pointer', position: 'relative',
      transition: 'all .2s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        {onToggleUnit ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 10.5, color: C.ink3, letterSpacing: 0.3, textTransform: 'uppercase', fontWeight: 600 }}>Weight</div>
            <div
              onClick={(e) => { e.stopPropagation(); onToggleUnit(); }}
              style={{
                display: 'inline-flex', padding: 2, gap: 1,
                borderRadius: 999, background: C.paper, border: `1px solid ${C.line}`,
                fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3,
                cursor: 'pointer', userSelect: 'none',
              }}
            >
              <span style={{
                padding: '2px 7px', borderRadius: 999,
                background: unit === 'kg' ? C.ink : 'transparent',
                color: unit === 'kg' ? C.paper : C.ink3,
                transition: 'background .15s',
              }}>KG</span>
              <span style={{
                padding: '2px 7px', borderRadius: 999,
                background: unit === 'lb' ? C.ink : 'transparent',
                color: unit === 'lb' ? C.paper : C.ink3,
                transition: 'background .15s',
              }}>LB</span>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 10.5, color: C.ink3, letterSpacing: 0.3, textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
        )}
        {active && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={(e) => { e.stopPropagation(); onNudge(-nudgeStep); }} style={{ width: 22, height: 22, borderRadius: 999, border: `1px solid ${C.line}`, background: C.paper, color: C.ink2, cursor: 'pointer', fontSize: 12, padding: 0 }}>−</button>
            <button onClick={(e) => { e.stopPropagation(); onNudge(nudgeStep); }} style={{ width: 22, height: 22, borderRadius: 999, border: `1px solid ${C.line}`, background: C.paper, color: C.ink2, cursor: 'pointer', fontSize: 12, padding: 0 }}>+</button>
          </div>
        )}
      </div>
      <div style={{
        fontFamily: 'Instrument Serif, serif',
        fontSize: 46, lineHeight: 1.05, marginTop: 2,
        fontFeatureSettings: '"tnum"', letterSpacing: '-0.02em',
        color: value ? C.ink : C.ink3 + '66',
        transform: pulse && active ? 'scale(1.04)' : 'scale(1)',
        transition: 'transform .3s',
      }}>
        {value || (integer ? '0' : '0.0')}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// HISTORY SCREEN
// ──────────────────────────────────────────────────────────
function HistoryScreen({ state, onOpenSession }) {
  const { history } = state;
  // Group by month
  const grouped = {};
  history.forEach(s => {
    grouped[s.month] = grouped[s.month] || [];
    grouped[s.month].push(s);
  });

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 20 }}>
      <div style={{ padding: '18px 22px 10px' }}>
        <Eyebrow>Training log</Eyebrow>
        <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 32, lineHeight: 1, marginTop: 6, letterSpacing: '-0.01em' }}>
          <span style={{ fontStyle: 'italic' }}>History</span>
        </div>
      </div>

      {/* Summary bar */}
      <div style={{
        margin: '6px 18px 8px', padding: '16px 18px',
        borderRadius: 18, background: C.card, border: `1px solid ${C.lineSoft}`,
        display: 'flex', gap: 24,
      }}>
        {[
          { v: '47', l: 'Sessions' },
          { v: '1,284', l: 'Sets' },
          { v: '38', l: 'Hours' },
        ].map((s, i) => (
          <div key={i}>
            <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 28, lineHeight: 1, fontFeatureSettings: '"tnum"', letterSpacing: '-0.01em' }}>{s.v}</div>
            <div style={{ fontSize: 10, color: C.ink3, marginTop: 4, letterSpacing: 0.3, textTransform: 'uppercase' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Grouped list */}
      <div style={{ padding: '6px 22px 0' }}>
        {Object.entries(grouped).map(([month, sessions]) => (
          <div key={month} style={{ marginTop: 18 }}>
            <Eyebrow>{month}</Eyebrow>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sessions.map(s => (
                <button key={s.id} onClick={() => onOpenSession(s)} style={{
                  padding: '14px 16px', borderRadius: 14,
                  border: `1px solid ${C.lineSoft}`, background: C.card,
                  cursor: 'pointer', fontFamily: 'inherit',
                  textAlign: 'left',
                  display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 14,
                }}>
                  <div style={{
                    width: 44, textAlign: 'center',
                    padding: '6px 0',
                    borderRadius: 10, background: C.paper,
                    border: `1px solid ${C.lineSoft}`,
                  }}>
                    <div style={{ fontSize: 9.5, color: C.ink3, letterSpacing: 0.3, textTransform: 'uppercase', fontWeight: 600 }}>{s.mon}</div>
                    <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 20, lineHeight: 1, marginTop: 2, fontFeatureSettings: '"tnum"' }}>{s.day}</div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: C.ink3, marginTop: 3, fontFeatureSettings: '"tnum"' }}>
                      {s.duration} · {s.sets} sets · {s.volume}
                    </div>
                  </div>
                  <div style={{ color: C.ink3 }}>{Icon.chev('right')}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// SESSION DETAIL (inside History)
// ──────────────────────────────────────────────────────────
function SessionDetailScreen({ session, onBack }) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', background: C.paper }}>
      <div style={{ padding: '12px 16px 0' }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: C.ink, cursor: 'pointer', padding: 8, marginLeft: -8 }}>
          {Icon.back}
        </button>
      </div>
      <div style={{ padding: '4px 22px 16px' }}>
        <Eyebrow>{session.mon} {session.day} · {session.duration}</Eyebrow>
        <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 28, lineHeight: 1.1, marginTop: 6, letterSpacing: '-0.01em', textWrap: 'balance' }}>
          {session.label}
        </div>
      </div>
      <div style={{
        margin: '0 18px 14px', padding: '14px 18px',
        borderRadius: 18, background: C.card, border: `1px solid ${C.lineSoft}`,
        display: 'flex', gap: 20,
      }}>
        {[
          { v: session.sets.toString(), l: 'Sets' },
          { v: session.volume, l: 'Volume' },
          { v: session.duration, l: 'Time' },
        ].map((s, i) => (
          <div key={i}>
            <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 24, lineHeight: 1, fontFeatureSettings: '"tnum"' }}>{s.v}</div>
            <div style={{ fontSize: 10, color: C.ink3, marginTop: 3, letterSpacing: 0.3, textTransform: 'uppercase' }}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '0 22px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {session.exercises.map((ex, i) => (
          <div key={i} style={{
            padding: '14px 16px', borderRadius: 14,
            border: `1px solid ${C.lineSoft}`, background: C.card,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{ex.name}</div>
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ex.sets.map((s, si) => (
                <span key={si} style={{
                  fontSize: 11, padding: '4px 8px',
                  borderRadius: 999, background: C.sageSoft, color: C.sageDeep,
                  fontFeatureSettings: '"tnum"', fontWeight: 600,
                }}>
                  {s.weight ? `${s.weight}×${s.reps}` : `${s.reps}`}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// SETTINGS SCREEN
// ──────────────────────────────────────────────────────────
function SettingsScreen({ state, onToggleUnit, onToggleTheme, onOpenImport }) {
  const { settings, routine } = state;
  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: '18px 22px 8px' }}>
        <Eyebrow>Preferences</Eyebrow>
        <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 32, lineHeight: 1, marginTop: 6, letterSpacing: '-0.01em' }}>
          <span style={{ fontStyle: 'italic' }}>Settings</span>
        </div>
      </div>

      {/* Active routine card */}
      <div style={{ padding: '14px 18px 0' }}>
        <div style={{
          borderRadius: 18, padding: '16px 18px',
          background: C.card, border: `1px solid ${C.lineSoft}`,
        }}>
          <Eyebrow>Active routine</Eyebrow>
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 22, marginTop: 4, lineHeight: 1.1 }}>{routine.name}</div>
          <div style={{ fontSize: 11.5, color: C.ink3, marginTop: 6, fontFeatureSettings: '"tnum"' }}>
            {routine.dayOrder.length} days · {routine.dayOrder.join(' · ')} · rest 90s
          </div>
        </div>
      </div>

      {/* List rows */}
      <div style={{ padding: '20px 22px 0' }}>
        <Eyebrow>Display</Eyebrow>
        <div style={{ marginTop: 10, borderRadius: 16, background: C.card, border: `1px solid ${C.lineSoft}`, overflow: 'hidden' }}>
          <RowToggle label="Units" sub="Weight display" value={settings.unit} options={['kg', 'lbs']} onChange={onToggleUnit} />
          <div style={{ height: 1, background: C.lineSoft, margin: '0 16px' }} />
          <RowToggle label="Theme" sub="Light is calmer; dark is focused" value={settings.theme} options={['light', 'auto']} onChange={onToggleTheme} />
        </div>
      </div>

      <div style={{ padding: '20px 22px 0' }}>
        <Eyebrow>Data</Eyebrow>
        <div style={{ marginTop: 10, borderRadius: 16, background: C.card, border: `1px solid ${C.lineSoft}`, overflow: 'hidden' }}>
          <RowLink label="Import routine (YAML)" sub="Load a new plan" onClick={onOpenImport} />
          <div style={{ height: 1, background: C.lineSoft, margin: '0 16px' }} />
          <RowLink label="Export all sessions" sub="Backup as JSON" />
          <div style={{ height: 1, background: C.lineSoft, margin: '0 16px' }} />
          <RowLink label="Exercise catalog" sub="124 exercises" />
        </div>
      </div>

      <div style={{ padding: '20px 22px 24px' }}>
        <Eyebrow>About</Eyebrow>
        <div style={{ marginTop: 10, padding: '14px 16px', borderRadius: 14, background: C.card, border: `1px solid ${C.lineSoft}`, fontSize: 12, color: C.ink3, lineHeight: 1.6 }}>
          Exercise Logger v0.4<br/>
          Built for simple, honest strength tracking.<br/>
          Your data stays on device.
        </div>
      </div>
    </div>
  );
}

function RowToggle({ label, sub, value, options, onChange }) {
  return (
    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11.5, color: C.ink3, marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 999, background: C.paper, border: `1px solid ${C.line}` }}>
        {options.map(o => (
          <button key={o} onClick={() => onChange(o)} style={{
            padding: '5px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
            background: value === o ? C.ink : 'transparent',
            color: value === o ? C.paper : C.ink2,
            fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit', letterSpacing: 0.3, textTransform: 'uppercase',
          }}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function RowLink({ label, sub, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>{label}</div>
        <div style={{ fontSize: 11.5, color: C.ink3, marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ color: C.ink3 }}>{Icon.chev('right')}</div>
    </button>
  );
}

// ──────────────────────────────────────────────────────────
// EXERCISE PICKER SHEET
// ──────────────────────────────────────────────────────────
function ExercisePicker({ open, onClose, onPick, catalog }) {
  const [q, setQ] = React.useState('');
  if (!open) return null;
  const filtered = catalog.filter(e => e.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(20, 18, 14, 0.38)', zIndex: 40,
        animation: 'fadeIn .2s ease',
      }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, top: 80, zIndex: 50,
        background: C.paper, borderRadius: '26px 26px 0 0',
        display: 'flex', flexDirection: 'column',
        animation: 'slideUp .32s cubic-bezier(.2,.9,.3,1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 42, height: 4, borderRadius: 3, background: C.line }} />
        </div>
        <div style={{ padding: '8px 22px 14px' }}>
          <Eyebrow>Add extra</Eyebrow>
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 24, marginTop: 4, lineHeight: 1.1 }}>Pick an exercise</div>
          <input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)}
            style={{
              marginTop: 12, width: '100%', boxSizing: 'border-box',
              padding: '12px 14px', borderRadius: 12,
              border: `1px solid ${C.line}`, background: C.card,
              fontSize: 14, fontFamily: 'inherit', color: C.ink,
              outline: 'none',
            }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 18px' }}>
          {filtered.map(ex => (
            <button key={ex.id} onClick={() => onPick(ex)} style={{
              width: '100%', padding: '13px 14px',
              background: 'transparent', border: 'none',
              borderBottom: `1px solid ${C.lineSoft}`,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              textAlign: 'left', color: C.ink,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{ex.name}</div>
                <div style={{ fontSize: 11, color: C.ink3, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 }}>{ex.type} · {ex.muscle}</div>
              </div>
              <span style={{ color: C.ink3 }}>{Icon.plus}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────
// CONFIRM DIALOG
// ──────────────────────────────────────────────────────────
function ConfirmDialog({ open, title, desc, confirmLabel, onConfirm, onClose, variant }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(20,18,14,0.4)', zIndex: 60,
        animation: 'fadeIn .2s',
      }} />
      <div style={{
        position: 'absolute', left: 24, right: 24, top: '40%', zIndex: 70,
        background: C.paper, borderRadius: 20, padding: '20px 22px',
        animation: 'popIn .25s cubic-bezier(.2,.9,.3,1)',
        boxShadow: '0 20px 60px rgba(20,18,14,0.2)',
      }}>
        <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 22, lineHeight: 1.15 }}>{title}</div>
        <div style={{ fontSize: 13, color: C.ink2, marginTop: 8, lineHeight: 1.5 }}>{desc}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px', borderRadius: 12,
            border: `1px solid ${C.line}`, background: 'transparent', color: C.ink,
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '12px', borderRadius: 12, border: 'none',
            background: variant === 'danger' ? C.danger : C.ink, color: C.paper,
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
          }}>{confirmLabel}</button>
        </div>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────
// FINISH TOAST
// ──────────────────────────────────────────────────────────
function FinishCelebration({ open, stats }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 80,
      background: C.sage, color: C.paper,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 30, animation: 'fadeIn .4s',
    }}>
      <div style={{ color: 'rgba(255,255,255,0.75)' }}>{Icon.sparkle}</div>
      <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 42, lineHeight: 1, marginTop: 14, letterSpacing: '-0.01em', textAlign: 'center' }}>
        Well done.
      </div>
      <div style={{ fontSize: 14, opacity: 0.85, marginTop: 10, textAlign: 'center' }}>
        Another session in the log.
      </div>
      <div style={{ display: 'flex', gap: 26, marginTop: 26 }}>
        {stats.map((s, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 32, lineHeight: 1, fontFeatureSettings: '"tnum"' }}>{s.v}</div>
            <div style={{ fontSize: 10, opacity: 0.8, marginTop: 4, letterSpacing: 0.3, textTransform: 'uppercase' }}>{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// IMPORT ROUTINE SCREEN
// ──────────────────────────────────────────────────────────
function ImportRoutineScreen({ onBack, onImport }) {
  const [pasted, setPasted] = React.useState('');
  const [parsing, setParsing] = React.useState(false);
  const [parsed, setParsed] = React.useState(null);

  const GPT_URL = 'https://chatgpt.com/g/g-ace-logger';

  const SAMPLE_YAML = `version: 1
name: "Upper / Lower Split"
rest_default_sec: 120
day_order: [A, B]

days:
  A:
    label: "Upper — Push Focus"
    entries:
      - exercise_id: bench-press
        sets:
          - { reps: [5, 8], count: 4 }
      - exercise_id: overhead-press
        sets:
          - { reps: [8, 10], count: 3 }`;

  const parse = () => {
    setParsing(true);
    setTimeout(() => {
      setParsing(false);
      setParsed({
        name: 'Upper / Lower Split',
        days: 2,
        exercises: 11,
        dayOrder: ['A', 'B'],
      });
    }, 700);
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 24 }}>
      {/* Header with back */}
      <div style={{ padding: '10px 14px 0' }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: C.ink, cursor: 'pointer', padding: 8, marginLeft: -4, display: 'flex', alignItems: 'center', gap: 4 }}>
          {Icon.back}<span style={{ fontSize: 13, fontFamily: 'inherit' }}>Settings</span>
        </button>
      </div>
      <div style={{ padding: '4px 22px 12px' }}>
        <Eyebrow>New routine</Eyebrow>
        <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 32, lineHeight: 1.05, marginTop: 6, letterSpacing: '-0.01em', textWrap: 'balance' }}>
          <span style={{ fontStyle: 'italic' }}>Import</span> a plan
        </div>
        <div style={{ fontSize: 13, color: C.ink2, marginTop: 8, lineHeight: 1.5 }}>
          Chat with our coach GPT to design your routine, then paste the YAML it gives you.
        </div>
      </div>

      {/* Step 1 — Open ACE Logger GPT */}
      <div style={{ padding: '6px 18px 0' }}>
        <div style={{
          borderRadius: 18, border: `1px solid ${C.lineSoft}`, background: C.card,
          padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 999,
            background: C.sageSoft, color: C.sageDeep,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Instrument Serif, serif', fontSize: 16, fontWeight: 600,
            flexShrink: 0, marginTop: 1,
          }}>1</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Chat with ACE Logger GPT</div>
            <div style={{ fontSize: 12, color: C.ink3, marginTop: 4, lineHeight: 1.5 }}>
              Answer a few questions about your goals, schedule, and equipment. It'll build a personalized plan and hand you back a YAML block.
            </div>
            <a
              href={GPT_URL} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                marginTop: 12, padding: '9px 14px', borderRadius: 11,
                background: C.ink, color: C.paper, textDecoration: 'none',
                fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
              }}
            >
              Open ACE Logger GPT
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17 17 7"/><path d="M8 7h9v9"/>
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Step 2 — Paste YAML */}
      <div style={{ padding: '14px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, padding: '0 0 0 0' }}>
          <div style={{
            width: 28, height: 28, borderRadius: 999,
            background: parsed ? C.sage : C.sageSoft,
            color: parsed ? C.paper : C.sageDeep,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Instrument Serif, serif', fontSize: 16, fontWeight: 600,
            flexShrink: 0, transition: 'background .2s',
          }}>2</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Paste the YAML answer</div>
            <div style={{ fontSize: 12, color: C.ink3, marginTop: 2 }}>Copy the code block from the GPT's reply.</div>
          </div>
        </div>

        <div style={{ borderRadius: 16, border: `1px solid ${parsed ? C.sage : C.line}`, background: C.card, overflow: 'hidden', transition: 'border-color .2s' }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.lineSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Eyebrow>YAML</Eyebrow>
            <button onClick={() => setPasted(SAMPLE_YAML)} style={{ background: 'transparent', border: 'none', color: C.ink3, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 500 }}>
              Try sample
            </button>
          </div>
          <textarea
            value={pasted}
            onChange={e => { setPasted(e.target.value); setParsed(null); }}
            placeholder="Paste YAML from ACE Logger GPT here…"
            style={{
              width: '100%', minHeight: 180, maxHeight: 220, resize: 'vertical',
              padding: '12px 14px', border: 'none', outline: 'none',
              background: 'transparent', color: C.ink,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 11.5, lineHeight: 1.55, boxSizing: 'border-box',
            }}
          />
        </div>

        {parsed && (
          <div style={{
            marginTop: 12, padding: '14px 16px',
            borderRadius: 14, background: C.sageSoft, color: C.sageDeep,
            animation: 'fadeIn .25s ease',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>Ready to import</div>
            <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 20, lineHeight: 1.1, marginTop: 4 }}>{parsed.name}</div>
            <div style={{ fontSize: 12, marginTop: 4, fontFeatureSettings: '"tnum"' }}>
              {parsed.days} days ({parsed.dayOrder.join(' · ')}) · {parsed.exercises} exercises
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          {!parsed ? (
            <button onClick={parse} disabled={!pasted || parsing} style={{
              flex: 1, padding: '14px', borderRadius: 14,
              background: (!pasted || parsing) ? C.line : C.ink,
              color: (!pasted || parsing) ? C.ink3 : C.paper,
              border: 'none', cursor: (!pasted || parsing) ? 'default' : 'pointer',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
            }}>
              {parsing ? 'Parsing…' : 'Validate'}
            </button>
          ) : (
            <>
              <button onClick={() => { setParsed(null); setPasted(''); }} style={{
                padding: '14px 18px', borderRadius: 14,
                background: 'transparent', border: `1px solid ${C.line}`, color: C.ink,
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
              }}>Clear</button>
              <button onClick={onImport} style={{
                flex: 1, padding: '14px', borderRadius: 14,
                background: C.ink, color: C.paper, border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>{Icon.check} Import routine</button>
            </>
          )}
        </div>

        <div style={{ marginTop: 16, fontSize: 11, color: C.ink3, lineHeight: 1.55, textAlign: 'center' }}>
          Already have a YAML file? You can paste its contents here too.
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ImportRoutineScreen });

Object.assign(window, {
  AppShell, TodayScreen, WorkoutScreen, SetLogSheet,
  HistoryScreen, SessionDetailScreen, SettingsScreen,
  ExercisePicker, ConfirmDialog, FinishCelebration, Eyebrow, Icon,
});
