/**
 * Shared audio utilities for the Origin admin and staff interfaces.
 */

/**
 * playAdminAlert — Short double-beep used in the Admin dashboard
 * for new orders and waiter calls.
 */
export function playAdminAlert() {
  try {
    const ctx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.5)
  } catch {}
}

/**
 * playKDSAlert — macOS-style harmonic chime used in the Staff KDS
 * when a new order arrives.
 */
export function playKDSAlert() {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()

  const masterGain = ctx.createGain()
  masterGain.gain.value = 0.32
  masterGain.connect(ctx.destination)

  const now = ctx.currentTime

  function createTone(
    freq: number,
    delay: number,
    duration: number,
    volume: number,
  ) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const filter = ctx.createBiquadFilter()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now + delay)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(3200, now + delay)

    gain.gain.setValueAtTime(0.001, now + delay)
    gain.gain.exponentialRampToValueAtTime(volume, now + delay + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(masterGain)

    osc.start(now + delay)
    osc.stop(now + delay + duration + 0.2)
  }

  createTone(880, 0.0, 1.2, 0.45)
  createTone(1109, 0.0, 1.1, 0.38)
  createTone(1320, 0.05, 0.95, 0.3)
  createTone(1760, 0.03, 0.65, 0.18)
  createTone(2200, 0.08, 0.55, 0.12)

  setTimeout(() => {
    createTone(987.8, 0, 0.8, 0.22)
    createTone(1244.5, 0.02, 0.7, 0.18)
  }, 220)
}
