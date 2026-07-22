import { useEffect, useMemo, useRef, useState } from 'react'
import { BlockMath, InlineMath } from 'react-katex'
import 'katex/dist/katex.min.css'
import './App.css'

const GROUND_Y = 230
const DROP_TOP_Y = 42
const START_X = 72
const STAGE_WIDTH = 800
const BOUNCE_XS = [156, 266, 376, 486, 626, 716]
const CONCRETE_BOUNCES = 4
const ANIMATION_SCALE_MS = 430
const INTERVAL_REVEAL_DELAY_SECONDS = 0.5
const GENERAL_BOUNCE_HEIGHT_SCALE = 0.34

function round(value, places = 2) {
  return Number(value).toFixed(places).replace(/\.?0+$/, '')
}

function normalizeAnswer(value) {
  return value
    .toLowerCase()
    .replace(/\s/g, '')
    .replace(/\*/g, '')
    .replace(/x/g, '')
    .replace(/times/g, '')
    .replace(/\^/g, '')
    .replace(/[{}]/g, '')
}

function seededRandom(seed) {
  const next = Math.sin(seed) * 10000
  return next - Math.floor(next)
}

function shuffleOptions(options, seed) {
  const shuffled = [...options]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(seededRandom(seed + index * 97) * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  return shuffled
}

const optionFeedback = {
  'first-correct': 'Correct. The ball travels up and down, so the bounce interval is twice the time to maximum height.',
  'first-no-two': 'This finds only one half of the bounce. The ball must go up and come back down, so multiply by 2.',
  'first-shift': 'This uses the next power. From the 1st to 2nd bounce, use the first bounce factor.',
  'first-original': 'This is only the initial drop value. After the first bounce, the interval follows the bounce factor and includes the up-and-down journey.',
  'second-correct': 'Correct. The next interval keeps the same structure, with the next power in the pattern.',
  'second-no-two': 'This again counts only one half of the motion. Each interval between bounces includes going up and coming down.',
  'second-shift-back': 'This repeats the previous interval. The 2nd to 3rd bounce should use the next power.',
  'second-linear': 'This jumps one power too far. Track the pattern one bounce at a time.',
  'time-correct': 'Correct. The interval ending at the nth bounce has exponent n - 1.',
  'time-shift': 'This is one bounce too far. The interval from the (n-1)th to nth bounce ends at bounce n, so the power is n - 1.',
  'time-missing-two': 'This counts only the upward trip. Between bounces, the ball goes up and comes down, so the factor of 2 is needed.',
  'time-square': 'This treats the time ratio as if it were squared. For time, the common ratio is r, not r squared.',
  'distance-correct': 'Correct. The distance factor is r, so the interval ending at the nth bounce has exponent n - 1.',
  'distance-time-ratio': 'This squares the factor unnecessarily. In distance mode, r is already the height or distance factor.',
  'distance-shift': 'This is one interval too far. The interval from the (n-1)th to nth bounce uses power n - 1.',
  'distance-missing-two': 'This counts only the upward distance. Between bounces, the ball travels up and down, so multiply by 2.',
  'setup-correct': 'Correct. Writing the full expression makes the structure visible before using any formula.',
  'setup-first-as-bounce': 'The first term is not another bounce interval. It is the initial drop before any bounce happens.',
  'setup-wrong-last': 'The last term is too far along. Check the sketch: up to the nth bounce, the final bounce interval has power n - 1.',
  'terms-correct': 'Correct. The powers run from 0 to n - 2, so there are n - 1 terms.',
  'terms-n': 'Close, but count the powers carefully: 0, 1, 2, ..., n - 2 gives n - 1 terms.',
  'terms-n-minus-2': 'This mistakes the last power for the number of terms. Starting from power 0 adds one more term.',
  'terms-two-n': 'The factor 2 is part of each bounce interval, not the number of terms in the bracket.',
  'concept-correct': 'Exactly. Do not use S_n indiscriminately; first separate what actually belongs to the GP.',
  'concept-same-ratio': 'The bounce intervals do have a common ratio. The issue is that the initial drop is not part of that GP.',
  'concept-too-many': 'There are finitely many intervals up to the nth bounce. The difficulty is identifying which terms belong to the GP.',
  'concept-no-formula': 'GP formulas do work here, but only after the expression is set up correctly from the sketch.',
  'total-correct': 'Well done for completing the questions!',
  'total-no-initial': 'This is only the GP part. The initial drop term must be added separately.',
  'total-wrong-last': 'This uses the wrong final power. Revisit the term-count checkpoint: the bracket has n - 1 terms.',
  'total-add-tail': 'The tail term should be subtracted after applying the finite GP formula, not added.',
  'interval-first-correct': 'Correct. The interval between the 2nd and 3rd bounce is T_1 times r.',
  'interval-first-no-r': 'This forgets to multiply by the bounce factor r.',
  'interval-first-shift': 'This advances two powers instead of one.',
  'interval-first-two': 'T_1 already represents the full 1st bounce interval (up and down), so do not multiply by 2.',
  'interval-second-correct': 'Correct. The interval between the 3rd and 4th bounce is T_1 times r^2.',
  'interval-second-no-r': 'This repeats the previous bounce interval.',
  'interval-second-shift': 'This jumps one power too far along the progression.',
  'interval-second-two': 'T_1 already includes both upward and downward motion.',
  'interval-time-correct': 'Correct. The interval between the nth and (n+1)th bounce has exponent n - 1.',
  'interval-time-shift': 'This is one bounce too far along.',
  'interval-time-two': 'T_1 is already the full bounce interval, so no extra factor of 2 is needed.',
  'interval-time-square': 'The time factor is r, not r squared.',
  'interval-setup-correct': 'Correct. Measuring from the 1st bounce means every term belongs to the GP starting at T_1.',
  'interval-setup-drop': 'Measuring from the 1st bounce excludes the initial drop before the 1st bounce.',
  'interval-setup-wrong-last': 'Up to the nth bounce, the final bounce interval has power n - 2.',
  'interval-terms-correct': 'Correct. Powers run from 0 to n - 2, so there are n - 1 terms.',
  'interval-terms-n': 'Count carefully: powers 0, 1, ..., n - 2 give n - 1 terms.',
  'interval-terms-n-minus-2': 'Starting from power 0 adds one more term than the last exponent.',
  'interval-terms-two-n': 'There are n - 1 terms in the bracket.',
  'interval-concept-correct': 'Exactly! Measuring from the 1st bounce means every term belongs directly to the GP without an initial drop term.',
  'interval-concept-drop': 'The initial drop is excluded when measuring from the 1st bounce.',
  'interval-concept-inf': 'There are a finite number of bounce intervals.',
  'interval-concept-no-formula': 'GP formulas apply cleanly here.',
  'interval-total-correct': 'Well done! That is the simplified total time formula from the 1st to nth bounce.',
  'interval-total-wrong-exp': 'Check the exponent: the GP has n - 1 terms, so the power is n - 1.',
  'interval-total-with-drop': 'Measuring from the 1st bounce means we do not include the initial drop.',
  'interval-total-add': 'The GP sum formula subtracts r^(n-1) inside the bracket.',
}

function SvgIntervalLabel({ x, y, mode, timeSubMode, step, dropTime, firstInterval, height, ratio, visible }) {
  const isIntervalMode = mode === 'time' && timeSubMode === 'interval'
  const unit = mode === 'time' ? 's' : ''

  if (step === 0) {
    if (isIntervalMode) {
      return null
    }
    const dropText = mode === 'time' ? `${round(dropTime, 1)} s` : `${round(height, 1)}`
    return (
      <text x={x} y={y} textAnchor="middle" className={`reveal-label ${visible ? 'show' : ''}`}>
        {dropText}
      </text>
    )
  }

  if (isIntervalMode) {
    if (step === 1) {
      return (
        <text x={x} y={y} textAnchor="middle" className={`reveal-label ${visible ? 'show' : ''}`}>
          {`${round(firstInterval, 1)} s`}
        </text>
      )
    }
    const leading = `(${round(firstInterval, 1)})(${round(ratio)})`
    const exponent = step - 1
    return (
      <text x={x} y={y} textAnchor="middle" className={`reveal-label ${visible ? 'show' : ''}`}>
        {leading}
        <tspan dy="-7" className="svg-sup">
          {exponent}
        </tspan>
        {unit && <tspan dy="7"> {unit}</tspan>}
      </text>
    )
  }

  const leading = mode === 'time' ? `2(${round(dropTime, 1)})(${round(ratio)})` : `2(${round(height, 1)})(${round(ratio)})`
  const exponent = step

  return (
    <text x={x} y={y} textAnchor="middle" className={`reveal-label ${visible ? 'show' : ''}`}>
      {leading}
      <tspan dy="-7" className="svg-sup">
        {exponent}
      </tspan>
      {unit && <tspan dy="7"> {unit}</tspan>}
    </text>
  )
}

function WrappedFormula({ math }) {
  const parts = math.split('+')

  return (
    <span className="wrapped-formula">
      {parts.map((part, index) => (
        <span className="formula-piece" key={`${part}-${index}`}>
          {index > 0 && <span className="formula-plus">+</span>}
          <InlineMath math={part} />
        </span>
      ))}
    </span>
  )
}

function App() {
  const [dropTime, setDropTime] = useState(3)
  const [firstInterval, setFirstInterval] = useState(2)
  const [timeSubMode, setTimeSubMode] = useState('drop')
  const [ratio, setRatio] = useState(0.9)
  const [height, setHeight] = useState(1.2)
  const [mode, setMode] = useState('time')
  const [zoom, setZoom] = useState(100)

  function handleZoomIn() {
    setZoom((current) => Math.min(150, current + 10))
  }

  function handleZoomOut() {
    setZoom((current) => Math.max(50, current - 10))
  }

  function handleZoomReset() {
    setZoom(100)
  }
  const [isRunning, setIsRunning] = useState(false)
  const [animationPhase, setAnimationPhase] = useState('idle')
  const [elapsed, setElapsed] = useState(0)
  const [hasPlayed, setHasPlayed] = useState(false)
  const [revealedAnswers, setRevealedAnswers] = useState({ first: false, second: false })
  const [firstIntervalChoice, setFirstIntervalChoice] = useState('')
  const [firstIntervalCorrect, setFirstIntervalCorrect] = useState(false)
  const [secondIntervalChoice, setSecondIntervalChoice] = useState('')
  const [secondIntervalCorrect, setSecondIntervalCorrect] = useState(false)
  const [mcqChoice, setMcqChoice] = useState('')
  const [mcqCorrect, setMcqCorrect] = useState(false)
  const [setupChoice, setSetupChoice] = useState('')
  const [setupCorrect, setSetupCorrect] = useState(false)
  const [termCountChoice, setTermCountChoice] = useState('')
  const [termCountCorrect, setTermCountCorrect] = useState(false)
  const [conceptChoice, setConceptChoice] = useState('')
  const [conceptCorrect, setConceptCorrect] = useState(false)
  const [finalChoice, setFinalChoice] = useState('')
  const [finalCorrect, setFinalCorrect] = useState(false)
  const [answerPopup, setAnswerPopup] = useState(null)
  const [shuffleSeed, setShuffleSeed] = useState(() => Date.now())
  const startRef = useRef(0)
  const runStartElapsedRef = useRef(0)
  const bounceAudioRef = useRef(null)
  const correctAudioRef = useRef(null)
  const wrongAudioRef = useRef(null)
  const endingAudioRef = useRef(null)
  const playedBounceCountRef = useRef(0)

  const bounceXs = useMemo(() => BOUNCE_XS, [])

  useEffect(() => {
    bounceAudioRef.current = new Audio('/bounce.mp3')
    correctAudioRef.current = new Audio('/correct.mp3')
    wrongAudioRef.current = new Audio('/wrong.mp3')
    endingAudioRef.current = new Audio('/ending.mp3')
    bounceAudioRef.current.preload = 'auto'
    correctAudioRef.current.preload = 'auto'
    wrongAudioRef.current.preload = 'auto'
    endingAudioRef.current.preload = 'auto'
  }, [])

  function playAudio(audio) {
    if (!audio) return
    const sound = audio.cloneNode()
    sound.currentTime = 0
    sound.play().catch(() => {})
  }

  function unlockAudio(audio) {
    if (!audio) return
    const originalVolume = audio.volume
    audio.volume = 0
    audio.currentTime = 0
    audio
      .play()
      .then(() => {
        audio.pause()
        audio.currentTime = 0
        audio.volume = originalVolume
      })
      .catch(() => {
        audio.volume = originalVolume
      })
  }

  function playResponseSound(isCorrect) {
    playAudio(isCorrect ? correctAudioRef.current : wrongAudioRef.current)
  }

  const effectiveDropTime = useMemo(() => {
    if (mode === 'time' && timeSubMode === 'interval') {
      return firstInterval / (2 * ratio)
    }
    return dropTime
  }, [mode, timeSubMode, firstInterval, ratio, dropTime])

  const flightSegments = useMemo(() => {
    let cursor = 0
    const first = {
      kind: 'drop',
      startTime: 0,
      endTime: effectiveDropTime,
      fromX: START_X,
      toX: bounceXs[0],
      heightRatio: 1,
    }
    cursor = effectiveDropTime

    const bounces = Array.from({ length: bounceXs.length - 1 }, (_, index) => {
      const bounceNumber = index + 1
      const halfTime = effectiveDropTime * ratio ** bounceNumber
      const visualScale = bounceNumber > CONCRETE_BOUNCES ? GENERAL_BOUNCE_HEIGHT_SCALE : 1
      const segment = {
        kind: 'bounce',
        startTime: cursor,
        endTime: cursor + 2 * halfTime,
        fromX: bounceXs[index],
        toX: bounceXs[index + 1],
        heightRatio: ratio ** bounceNumber * visualScale,
        bounceNumber,
      }
      cursor = segment.endTime
      return segment
    })

    return { list: [first, ...bounces], total: cursor }
  }, [bounceXs, effectiveDropTime, ratio])

  const visibleArcs = useMemo(() => {
    const drop = `M ${START_X} ${DROP_TOP_Y} Q ${(START_X + bounceXs[0]) / 2} ${DROP_TOP_Y} ${bounceXs[0]} ${GROUND_Y}`
    const bounces = Array.from({ length: bounceXs.length - 1 }, (_, index) => {
      const fromX = bounceXs[index]
      const toX = bounceXs[index + 1]
      const bounceNumber = index + 1
      const visualScale = bounceNumber > CONCRETE_BOUNCES ? GENERAL_BOUNCE_HEIGHT_SCALE : 1
      const peakY = GROUND_Y - 188 * ratio ** bounceNumber * visualScale
      return `M ${fromX} ${GROUND_Y} Q ${(fromX + toX) / 2} ${2 * peakY - GROUND_Y} ${toX} ${GROUND_Y}`
    })

    return {
      main: [drop, ...bounces.slice(0, CONCRETE_BOUNCES - 1)].join(' '),
      future: bounces.slice(CONCRETE_BOUNCES).join(' '),
    }
  }, [bounceXs, ratio])

  const activeArcIndex = useMemo(() => {
    const isIntervalMode = mode === 'time' && timeSubMode === 'interval'
    if (animationPhase === 'pausedFirst') return isIntervalMode ? 1 : 0
    if (animationPhase === 'pausedSecond') return isIntervalMode ? 2 : 1
    if (animationPhase === 'pausedNth') return 4
    return -1
  }, [animationPhase, mode, timeSubMode])

  const highlightedArcPath = useMemo(() => {
    if (activeArcIndex < 0 || activeArcIndex >= bounceXs.length - 1) return null
    const fromX = bounceXs[activeArcIndex]
    const toX = bounceXs[activeArcIndex + 1]
    const bounceNumber = activeArcIndex + 1
    const visualScale = bounceNumber > CONCRETE_BOUNCES ? GENERAL_BOUNCE_HEIGHT_SCALE : 1
    const peakY = GROUND_Y - 188 * ratio ** bounceNumber * visualScale
    return `M ${fromX} ${GROUND_Y} Q ${(fromX + toX) / 2} ${2 * peakY - GROUND_Y} ${toX} ${GROUND_Y}`
  }, [activeArcIndex, bounceXs, ratio])

  useEffect(() => {
    if (!isRunning) return undefined

    const isIntervalMode = mode === 'time' && timeSubMode === 'interval'
    const targetElapsed =
      animationPhase === 'runningToFirst'
        ? isIntervalMode
          ? flightSegments.list[2].endTime
          : flightSegments.list[1].endTime
        : animationPhase === 'runningToSecond'
          ? isIntervalMode
            ? flightSegments.list[3].endTime
            : flightSegments.list[2].endTime
          : animationPhase === 'runningToNth'
            ? flightSegments.list[5].endTime
            : flightSegments.total

    const tick = (time) => {
      if (!startRef.current) startRef.current = time
      const nextElapsed = Math.min(
        runStartElapsedRef.current + (time - startRef.current) / ANIMATION_SCALE_MS,
        targetElapsed,
      )
      setElapsed(nextElapsed)

      if (nextElapsed < targetElapsed) {
        requestAnimationFrame(tick)
      } else {
        setIsRunning(false)
        if (animationPhase === 'runningToFirst') {
          setAnimationPhase('pausedFirst')
        } else if (animationPhase === 'runningToSecond') {
          setAnimationPhase('pausedSecond')
        } else if (animationPhase === 'runningToNth') {
          setAnimationPhase('pausedNth')
        } else {
          setAnimationPhase('complete')
          setHasPlayed(true)
        }
        startRef.current = 0
      }
    }

    const frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [animationPhase, flightSegments.list, flightSegments.total, isRunning, mode, timeSubMode])

  const ball = useMemo(() => {
    const segment = flightSegments.list.find((item) => elapsed <= item.endTime) ?? flightSegments.list.at(-1)
    const local = Math.max(0, Math.min(1, (elapsed - segment.startTime) / (segment.endTime - segment.startTime)))
    const x = segment.fromX + (segment.toX - segment.fromX) * local

    if (segment.kind === 'drop') {
      return { x, y: DROP_TOP_Y + (GROUND_Y - DROP_TOP_Y) * local ** 2 }
    }

    const peakHeight = 188 * segment.heightRatio
    const y = GROUND_Y - 4 * peakHeight * local * (1 - local)
    return { x, y }
  }, [elapsed, flightSegments.list])

  const ballHidden = ball.x > bounceXs[CONCRETE_BOUNCES - 1] && ball.x < bounceXs[CONCRETE_BOUNCES]

  const revealState = useMemo(() => {
    const completedSegments = flightSegments.list.filter((segment) => elapsed >= segment.endTime).length
    const delayInModelTime = (INTERVAL_REVEAL_DELAY_SECONDS * 1000) / ANIMATION_SCALE_MS
    const completedIntervals = flightSegments.list.filter((segment) => elapsed >= segment.endTime + delayInModelTime).length
    const segment = flightSegments.list.find((item) => elapsed <= item.endTime) ?? flightSegments.list.at(-1)
    const local = Math.max(0, Math.min(1, (elapsed - segment.startTime) / (segment.endTime - segment.startTime)))

    if (hasPlayed) {
      return { bounce: 8, interval: 7, dots: true }
    }

    return {
      bounce: Math.min(8, completedSegments),
      interval: Math.min(7, completedIntervals),
      dots: completedSegments >= 4 || (segment.bounceNumber === 4 && local > 0.35),
    }
  }, [elapsed, flightSegments.list, hasPlayed])

  useEffect(() => {
    const completedBounces = flightSegments.list.filter((segment) => elapsed >= segment.endTime).length
    if (completedBounces > playedBounceCountRef.current) {
      const newBounceCount = completedBounces - playedBounceCountRef.current
      for (let count = 0; count < newBounceCount; count += 1) {
        playAudio(bounceAudioRef.current)
      }
      playedBounceCountRef.current = completedBounces
    }
  }, [elapsed, flightSegments.list])

  const visibleIntervals = {
    firstDrop: revealState.interval >= 1 || hasPlayed,
    firstBounce: revealedAnswers.first || hasPlayed,
    secondBounce: revealedAnswers.second || hasPlayed,
    thirdBounce: revealState.interval >= 4 || hasPlayed,
  }

  const mcqOptions = useMemo(() => {
    const isIntervalMode = mode === 'time' && timeSubMode === 'interval'
    const t = round(isIntervalMode ? firstInterval : dropTime, 1)
    const h = round(height, 1)
    const r = round(ratio)

    if (mode === 'time') {
      if (isIntervalMode) {
        return shuffleOptions(
          [
            { id: 'interval-time-correct', latex: `(${t})(${r})^{n-1}`, correct: true },
            { id: 'interval-time-shift', latex: `(${t})(${r})^n`, correct: false },
            { id: 'interval-time-two', latex: `2(${t})(${r})^{n-1}`, correct: false },
            { id: 'interval-time-square', latex: `(${t})(${r})^{2(n-1)}`, correct: false },
          ],
          shuffleSeed + 11,
        )
      }
      return shuffleOptions(
        [
          { id: 'time-correct', latex: `2(${t})(${r})^{n-1}`, correct: true },
          { id: 'time-shift', latex: `2(${t})(${r})^n`, correct: false },
          { id: 'time-missing-two', latex: `(${t})(${r})^{n-1}`, correct: false },
          { id: 'time-square', latex: `2(${t})(${r})^{2(n-1)}`, correct: false },
        ],
        shuffleSeed + 11,
      )
    }

    return shuffleOptions(
      [
        { id: 'distance-correct', latex: `2(${h})(${r})^{n-1}`, correct: true },
        { id: 'distance-time-ratio', latex: `2(${h})(${r}^2)^{n-1}`, correct: false },
        { id: 'distance-shift', latex: `2(${h})(${r})^n`, correct: false },
        { id: 'distance-missing-two', latex: `(${h})(${r})^{n-1}`, correct: false },
      ],
      shuffleSeed + 12,
    )
  }, [dropTime, firstInterval, height, mode, timeSubMode, ratio, shuffleSeed])

  const concreteIntervalOptions = useMemo(() => {
    const isIntervalMode = mode === 'time' && timeSubMode === 'interval'
    const base = isIntervalMode ? round(firstInterval, 1) : mode === 'time' ? round(dropTime, 1) : round(height, 1)
    const r = round(ratio)
    const firstPower = '1'
    const secondPower = '2'

    if (isIntervalMode) {
      return {
        first: shuffleOptions(
          [
            { id: 'interval-first-correct', latex: `(${base})(${r})^{${firstPower}}`, correct: true },
            { id: 'interval-first-no-r', latex: `${base}`, correct: false },
            { id: 'interval-first-shift', latex: `(${base})(${r})^{${secondPower}}`, correct: false },
            { id: 'interval-first-two', latex: `2(${base})(${r})^{${firstPower}}`, correct: false },
          ],
          shuffleSeed + 21,
        ),
        second: shuffleOptions(
          [
            { id: 'interval-second-correct', latex: `(${base})(${r})^{${secondPower}}`, correct: true },
            { id: 'interval-second-no-r', latex: `(${base})(${r})^{${firstPower}}`, correct: false },
            { id: 'interval-second-shift', latex: `(${base})(${r})^3`, correct: false },
            { id: 'interval-second-two', latex: `2(${base})(${r})^{${secondPower}}`, correct: false },
          ],
          shuffleSeed + 22,
        ),
      }
    }

    return {
      first: shuffleOptions(
        [
          { id: 'first-correct', latex: `2(${base})(${r})^{${firstPower}}`, correct: true },
          { id: 'first-no-two', latex: `(${base})(${r})^{${firstPower}}`, correct: false },
          { id: 'first-shift', latex: `2(${base})(${r})^{${secondPower}}`, correct: false },
          { id: 'first-original', latex: `${base}`, correct: false },
        ],
        shuffleSeed + 21,
      ),
      second: shuffleOptions(
        [
          { id: 'second-correct', latex: `2(${base})(${r})^{${secondPower}}`, correct: true },
          { id: 'second-no-two', latex: `(${base})(${r})^{${secondPower}}`, correct: false },
          { id: 'second-shift-back', latex: `2(${base})(${r})^{${firstPower}}`, correct: false },
          { id: 'second-linear', latex: `2(${base})(${r})^3`, correct: false },
        ],
        shuffleSeed + 22,
      ),
    }
  }, [dropTime, firstInterval, height, mode, timeSubMode, ratio, shuffleSeed])

  const numericWork = useMemo(() => {
    const isIntervalMode = mode === 'time' && timeSubMode === 'interval'
    const base = isIntervalMode ? firstInterval : mode === 'time' ? dropTime : height
    const baseText = round(base, 1)
    const rText = round(ratio)
    const gpRatio = ratio
    const gpRatioText = round(gpRatio, 4)

    if (isIntervalMode) {
      const multiplier = firstInterval / (1 - gpRatio)
      const multiplierText = round(multiplier, 4)
      const effectiveDropText = round(effectiveDropTime, 1)
      const terms = `${baseText}+(${baseText})(${rText})^1+(${baseText})(${rText})^2+...+(${baseText})(${rText})^{n-2}`
      const setupWrongDrop = `${effectiveDropText}+${baseText}+(${baseText})(${rText})^1+...+(${baseText})(${rText})^{n-2}`
      const setupWrongLast = `${baseText}+(${baseText})(${rText})^1+(${baseText})(${rText})^2+...+(${baseText})(${rText})^{n-1}`

      return {
        baseText,
        rText,
        gpRatioText,
        multiplierText,
        effectiveDropText,
        terms,
        setupWrongDrop,
        setupWrongLast,
        bracketComplete: `1+${rText}^1+${rText}^2+...+${rText}^{n-2}`,
        simplifiedLine: `${multiplierText}(1-${rText}^{n-1})`,
      }
    }

    const coefficient = 2 * base * gpRatio
    const coefficientText = round(coefficient, 4)
    const denominator = 1 - gpRatio
    const denominatorText = round(denominator, 4)
    const multiplier = coefficient / denominator
    const multiplierText = round(multiplier, 4)
    const simplifiedConstant = base + multiplier
    const simplifiedConstantText = round(simplifiedConstant, 4)
    const firstPower = `${rText}`
    const terms = `${baseText}+2(${baseText})(${rText})^1+2(${baseText})(${rText})^2+2(${baseText})(${rText})^3+...+2(${baseText})(${rText})^{n-1}`
    const setupWrongFirst = `2(${baseText})(${rText})^0+2(${baseText})(${rText})^1+2(${baseText})(${rText})^2+2(${baseText})(${rText})^3+...+2(${baseText})(${rText})^{n-1}`
    const setupWrongLast = `${baseText}+2(${baseText})(${rText})^1+2(${baseText})(${rText})^2+2(${baseText})(${rText})^3+...+2(${baseText})(${rText})^n`

    return {
      baseText,
      rText,
      gpRatioText,
      coefficientText,
      denominatorText,
      multiplierText,
      simplifiedConstantText,
      firstPower,
      terms,
      setupWrongFirst,
      setupWrongLast,
      bracketPreview: `1+${gpRatioText}+${gpRatioText}^2+...`,
      bracketComplete: `1+${gpRatioText}+${gpRatioText}^2+...+${gpRatioText}^{n-2}`,
      simplifiedLine: `${simplifiedConstantText}-${multiplierText}(${gpRatioText})^{n-1}`,
    }
  }, [dropTime, firstInterval, height, mode, timeSubMode, ratio, effectiveDropTime])

  const totalOptions = useMemo(() => {
    const isIntervalMode = mode === 'time' && timeSubMode === 'interval'
    if (isIntervalMode) {
      return shuffleOptions(
        [
          { id: 'interval-setup-correct', latex: numericWork.terms, correct: true },
          { id: 'interval-setup-drop', latex: numericWork.setupWrongDrop, correct: false },
          { id: 'interval-setup-wrong-last', latex: numericWork.setupWrongLast, correct: false },
        ],
        shuffleSeed + 31,
      )
    }
    return shuffleOptions(
      [
        { id: 'setup-correct', latex: numericWork.terms, correct: true },
        { id: 'setup-first-as-bounce', latex: numericWork.setupWrongFirst, correct: false },
        { id: 'setup-wrong-last', latex: numericWork.setupWrongLast, correct: false },
      ],
      shuffleSeed + 31,
    )
  }, [numericWork, mode, timeSubMode, shuffleSeed])

  const conceptOptions = useMemo(() => {
    const isIntervalMode = mode === 'time' && timeSubMode === 'interval'
    if (isIntervalMode) {
      return shuffleOptions(
        [
          {
            id: 'interval-concept-correct',
            correct: true,
            text: 'Measuring from the 1st bounce means every term belongs to the GP without an initial drop term.',
          },
          {
            id: 'interval-concept-drop',
            correct: false,
            text: 'Because the initial drop time must be added at the end.',
          },
          {
            id: 'interval-concept-inf',
            correct: false,
            text: 'Because there are infinitely many terms before the nth bounce.',
          },
          {
            id: 'interval-concept-no-formula',
            correct: false,
            text: 'Because GP sum formulas do not work for time mode.',
          },
        ],
        shuffleSeed + 41,
      )
    }
    return shuffleOptions(
      [
        {
          id: 'concept-correct',
          correct: true,
          text: 'The first drop is a separate term, while only the bounce intervals form the GP.',
        },
        {
          id: 'concept-same-ratio',
          correct: false,
          text: 'Because the common ratio changes at every bounce.',
        },
        {
          id: 'concept-too-many',
          correct: false,
          text: 'Because there are infinitely many terms before the nth bounce.',
        },
        {
          id: 'concept-no-formula',
          correct: false,
          text: 'Because GP sum formulas do not work for motion problems.',
        },
      ],
      shuffleSeed + 41,
    )
  }, [mode, timeSubMode, shuffleSeed])

  const termCountOptions = useMemo(() => {
    const isIntervalMode = mode === 'time' && timeSubMode === 'interval'
    if (isIntervalMode) {
      return shuffleOptions(
        [
          { id: 'interval-terms-correct', latex: 'n-1', correct: true },
          { id: 'interval-terms-n', latex: 'n', correct: false },
          { id: 'interval-terms-n-minus-2', latex: 'n-2', correct: false },
          { id: 'interval-terms-two-n', latex: '2(n-1)', correct: false },
        ],
        shuffleSeed + 51,
      )
    }
    return shuffleOptions(
      [
        { id: 'terms-correct', latex: 'n-1', correct: true },
        { id: 'terms-n', latex: 'n', correct: false },
        { id: 'terms-n-minus-2', latex: 'n-2', correct: false },
        { id: 'terms-two-n', latex: '2(n-1)', correct: false },
      ],
      shuffleSeed + 51,
    )
  }, [mode, timeSubMode, shuffleSeed])

  const finalOptions = useMemo(() => {
    const isIntervalMode = mode === 'time' && timeSubMode === 'interval'
    if (isIntervalMode) {
      return shuffleOptions(
        [
          { id: 'interval-total-correct', latex: numericWork.simplifiedLine, correct: true },
          {
            id: 'interval-total-wrong-exp',
            latex: `${numericWork.multiplierText}(1-${numericWork.gpRatioText}^n)`,
            correct: false,
          },
          {
            id: 'interval-total-with-drop',
            latex: `${numericWork.effectiveDropText}+${numericWork.multiplierText}(1-${numericWork.gpRatioText}^{n-1})`,
            correct: false,
          },
          {
            id: 'interval-total-add',
            latex: `${numericWork.multiplierText}(1+${numericWork.gpRatioText}^{n-1})`,
            correct: false,
          },
        ],
        shuffleSeed + 61,
      )
    }
    return shuffleOptions(
      [
        { id: 'total-correct', latex: numericWork.simplifiedLine, correct: true },
        {
          id: 'total-no-initial',
          latex: `${numericWork.multiplierText}(1-${numericWork.gpRatioText}^{n-1})`,
          correct: false,
        },
        {
          id: 'total-wrong-last',
          latex: `${numericWork.simplifiedConstantText}-${numericWork.multiplierText}(${numericWork.gpRatioText})^n`,
          correct: false,
        },
        {
          id: 'total-add-tail',
          latex: `${numericWork.simplifiedConstantText}+${numericWork.multiplierText}(${numericWork.gpRatioText})^{n-1}`,
          correct: false,
        },
      ],
      shuffleSeed + 61,
    )
  }, [numericWork, mode, timeSubMode, shuffleSeed])

  function startAnimation() {
    unlockAudio(bounceAudioRef.current)
    unlockAudio(correctAudioRef.current)
    unlockAudio(wrongAudioRef.current)
    unlockAudio(endingAudioRef.current)
    setElapsed(0)
    setHasPlayed(false)
    setRevealedAnswers({ first: false, second: false })
    setAnimationPhase('runningToFirst')
    setFirstIntervalChoice('')
    setFirstIntervalCorrect(false)
    setSecondIntervalChoice('')
    setSecondIntervalCorrect(false)
    setMcqChoice('')
    setMcqCorrect(false)
    setSetupChoice('')
    setSetupCorrect(false)
    setTermCountChoice('')
    setTermCountCorrect(false)
    setConceptChoice('')
    setConceptCorrect(false)
    setFinalChoice('')
    setFinalCorrect(false)
    setAnswerPopup(null)
    playedBounceCountRef.current = 0
    setShuffleSeed(Date.now())
    startRef.current = 0
    runStartElapsedRef.current = 0
    setIsRunning(true)
  }

  function continueAnimation(nextPhase) {
    startRef.current = 0
    runStartElapsedRef.current = elapsed
    setAnimationPhase(nextPhase)
    setIsRunning(true)
  }

  function chooseMcq(option) {
    setMcqChoice(option.id)
    setMcqCorrect(option.correct)
    playResponseSound(option.correct)
    setAnswerPopup({
      checkpoint: 'general',
      correct: option.correct,
      message: optionFeedback[option.id],
    })
  }

  function chooseFirstInterval(option) {
    setFirstIntervalChoice(option.id)
    setFirstIntervalCorrect(option.correct)
    playResponseSound(option.correct)
    setAnswerPopup({
      checkpoint: 'first',
      correct: option.correct,
      message: optionFeedback[option.id],
    })
  }

  function chooseSecondInterval(option) {
    setSecondIntervalChoice(option.id)
    setSecondIntervalCorrect(option.correct)
    playResponseSound(option.correct)
    setAnswerPopup({
      checkpoint: 'second',
      correct: option.correct,
      message: optionFeedback[option.id],
    })
  }

  function dismissAnswerPopup() {
    const popup = answerPopup
    setAnswerPopup(null)

    if (!popup?.correct) return

    if (popup.checkpoint === 'first' && animationPhase === 'pausedFirst') {
      setRevealedAnswers((current) => ({ ...current, first: true }))
      continueAnimation('runningToSecond')
    }

    if (popup.checkpoint === 'second' && animationPhase === 'pausedSecond') {
      setRevealedAnswers((current) => ({ ...current, second: true }))
      continueAnimation('runningToNth')
    }

    if (popup.checkpoint === 'general' && animationPhase === 'pausedNth') {
      setAnimationPhase('complete')
      setHasPlayed(true)
    }
  }

  function chooseSetup(option) {
    setSetupChoice(option.id)
    setSetupCorrect(option.correct)
    playResponseSound(option.correct)
    setAnswerPopup({
      checkpoint: 'setup',
      correct: option.correct,
      message: optionFeedback[option.id],
    })
  }

  function chooseTermCount(option) {
    setTermCountChoice(option.id)
    setTermCountCorrect(option.correct)
    playResponseSound(option.correct)
    setAnswerPopup({
      checkpoint: 'termCount',
      correct: option.correct,
      message: optionFeedback[option.id],
    })
  }

  function chooseConcept(option) {
    setConceptChoice(option.id)
    setConceptCorrect(option.correct)
    playResponseSound(option.correct)
    setAnswerPopup({
      checkpoint: 'concept',
      correct: option.correct,
      message: optionFeedback[option.id],
    })
  }

  function chooseTotal(option) {
    setFinalChoice(option.id)
    setFinalCorrect(option.correct)
    playResponseSound(option.correct)
    if (option.correct) {
      window.setTimeout(() => playAudio(endingAudioRef.current), 2000)
    }
    setAnswerPopup({
      checkpoint: 'final',
      correct: option.correct,
      message: optionFeedback[option.id],
    })
  }

  const hasReachedFirstPause = [
    'pausedFirst',
    'runningToSecond',
    'pausedSecond',
    'runningToNth',
    'pausedNth',
    'runningToEnd',
    'complete',
  ].includes(animationPhase)
  const hasReachedSecondPause = ['pausedSecond', 'runningToNth', 'pausedNth', 'runningToEnd', 'complete'].includes(
    animationPhase,
  )
  const hasReachedNthPause = ['pausedNth', 'runningToEnd', 'complete'].includes(animationPhase)
  const shouldShowPauseOverlay =
    animationPhase === 'pausedFirst' || animationPhase === 'pausedSecond' || animationPhase === 'pausedNth'

  return (
    <main className="app-shell">
      <div className="zoom-controls" aria-label="Zoom controls">
        <button type="button" className="zoom-btn" onClick={handleZoomOut} title="Zoom Out" aria-label="Zoom Out">
          –
        </button>
        <button type="button" className="zoom-reset-btn" onClick={handleZoomReset} title="Reset to 100%">
          {zoom}%
        </button>
        <button type="button" className="zoom-btn" onClick={handleZoomIn} title="Zoom In" aria-label="Zoom In">
          +
        </button>
      </div>

      <div className="zoom-scalable-content" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
        <section className="intro-band">
          <div className="title-lockup">
            <img src="/ball.png" alt="Tennis ball" className="header-ball" />
            <div>
              <p className="eyebrow">Geometric Progression</p>
              <h1>Tennis Ball Bounce Explorer</h1>
            </div>
          </div>
          <div className="mode-selection-group">
            <div className="mode-toggle" aria-label="Choose exploration mode">
              <button
                type="button"
                className={mode === 'time' ? 'active' : ''}
                onClick={() => {
                  setMode('time')
                  setAnimationPhase('idle')
                  setIsRunning(false)
                  setElapsed(0)
                  setHasPlayed(false)
                }}
              >
                Time
              </button>
              <button
                type="button"
                className={mode === 'distance' ? 'active' : ''}
                onClick={() => {
                  setMode('distance')
                  setAnimationPhase('idle')
                  setIsRunning(false)
                  setElapsed(0)
                  setHasPlayed(false)
                }}
              >
                Distance
              </button>
            </div>
            {mode === 'time' && (
              <div className="sub-mode-toggle" aria-label="Time mode sub-option">
                <button
                  type="button"
                  className={`sub-option-btn ${timeSubMode === 'drop' ? 'active' : ''}`}
                  onClick={() => {
                    setTimeSubMode('drop')
                    setAnimationPhase('idle')
                    setIsRunning(false)
                    setElapsed(0)
                    setHasPlayed(false)
                  }}
                >
                  Time to 1st Bounce
                </button>
                <button
                  type="button"
                  className={`sub-option-btn ${timeSubMode === 'interval' ? 'active' : ''}`}
                  onClick={() => {
                    setTimeSubMode('interval')
                    setAnimationPhase('idle')
                    setIsRunning(false)
                    setElapsed(0)
                    setHasPlayed(false)
                  }}
                >
                  Interval (1st → 2nd Bounce)
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="control-strip">
          <label>
            <span>
              {mode === 'time'
                ? timeSubMode === 'drop'
                  ? 'Drop time to 1st bounce'
                  : '1st Bounce Interval (1st → 2nd)'
                : 'Height of ball drop'}
            </span>
            {mode === 'time' ? (
              timeSubMode === 'drop' ? (
                <>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.1"
                    value={dropTime}
                    onChange={(event) => setDropTime(Number(event.target.value))}
                  />
                  <strong>{round(dropTime, 1)} s</strong>
                </>
              ) : (
                <>
                  <input
                    type="range"
                    min="0.5"
                    max="10"
                    step="0.1"
                    value={firstInterval}
                    onChange={(event) => setFirstInterval(Number(event.target.value))}
                  />
                  <strong>T₁ = {round(firstInterval, 1)} s</strong>
                </>
              )
            ) : (
              <>
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.1"
                  value={height}
                  onChange={(event) => setHeight(Number(event.target.value))}
                />
                <strong>{round(height, 1)} m</strong>
              </>
            )}
          </label>
          <label>
            <span>
              {mode === 'time'
                ? 'Time factor after each bounce'
                : 'Height factor to the top after each bounce'}
            </span>
            <input
              type="range"
              min="0.1"
              max="0.99"
              step="0.01"
              value={ratio}
              onChange={(event) => setRatio(Number(event.target.value))}
            />
            <strong>r = {round(ratio)}</strong>
          </label>
          <button type="button" className="start-button" onClick={startAnimation}>
            START
          </button>
        </section>

        <section className="stage-panel" aria-label="Animated bounce diagram">
          {shouldShowPauseOverlay && <div className="pause-overlay">Answer the question below</div>}
          <svg className="bounce-svg" viewBox={`0 0 ${STAGE_WIDTH} 390`} role="img" aria-label="Animated tennis ball bounce pattern">
            <defs>
              <marker id="arrow-start" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto">
                <path d="M6 0 L0 3 L6 6" className="arrow-head" />
              </marker>
              <marker id="arrow-end" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0 0 L6 3 L0 6" className="arrow-head" />
              </marker>
            </defs>
            <rect x="0" y={GROUND_Y} width={STAGE_WIDTH} height="56" className="ground" />
            <path className="bounce-trace" d={visibleArcs.main} />
            <path className="future-trace" d={visibleArcs.future} />
            {highlightedArcPath && <path className="highlighted-bounce-arc" d={highlightedArcPath} />}
            {bounceXs.map((x) => (
              <line key={x} x1={x} x2={x} y1={GROUND_Y} y2="342" className="bounce-marker" />
            ))}
            <image
              href="/ball.png"
              x={ball.x - 19}
              y={ball.y - 19}
              width="38"
              height="38"
              className={`ball-image ${ballHidden ? 'hidden' : ''}`}
            />
            {mode === 'time' ? (
              <text x="18" y="314" className="axis-label">
                Time
              </text>
            ) : (
              <text x="18" y="286" className="axis-label distance-mode">
                <tspan x="18" dy="0">Vertical</tspan>
                <tspan x="18" dy="16">distance</tspan>
                <tspan x="18" dy="16">travelled</tspan>
              </text>
            )}
            <text x="18" y="362" className="axis-label">
              Bounce
            </text>
            {mode === 'time' && (
              <>
                <line x1="84" y1="306" x2="146" y2="306" className="interval-line" />
                <line x1="166" y1="306" x2="256" y2="306" className="interval-line" />
                <line x1="276" y1="306" x2="366" y2="306" className="interval-line" />
                <line x1="386" y1="306" x2="476" y2="306" className="interval-line" />
                <line x1="636" y1="306" x2="706" y2="306" className="interval-line question-line" />
              </>
            )}
            <SvgIntervalLabel
              x="114"
              y="334"
              mode={mode}
              timeSubMode={timeSubMode}
              step={0}
              dropTime={dropTime}
              firstInterval={firstInterval}
              height={height}
              ratio={ratio}
              visible={visibleIntervals.firstDrop}
            />

            {/* Position x=211 (1st -> 2nd bounce) */}
            {mode === 'time' && timeSubMode === 'interval' ? (
              <SvgIntervalLabel
                x="211"
                y="334"
                mode={mode}
                timeSubMode={timeSubMode}
                step={1}
                dropTime={dropTime}
                firstInterval={firstInterval}
                height={height}
                ratio={ratio}
                visible={revealState.interval >= 1}
              />
            ) : (
              <>
                <text
                  x="211"
                  y="326"
                  textAnchor="middle"
                  className={`question-label ${animationPhase === 'pausedFirst' && !revealedAnswers.first ? 'show' : ''}`}
                >
                  ?
                </text>
                <SvgIntervalLabel
                  x="211"
                  y="334"
                  mode={mode}
                  timeSubMode={timeSubMode}
                  step={1}
                  dropTime={dropTime}
                  firstInterval={firstInterval}
                  height={height}
                  ratio={ratio}
                  visible={visibleIntervals.firstBounce}
                />
              </>
            )}

            {/* Position x=321 (2nd -> 3rd bounce) */}
            {mode === 'time' && timeSubMode === 'interval' ? (
              <>
                <text
                  x="321"
                  y="326"
                  textAnchor="middle"
                  className={`question-label ${animationPhase === 'pausedFirst' && !revealedAnswers.first ? 'show' : ''}`}
                >
                  ?
                </text>
                <SvgIntervalLabel
                  x="321"
                  y="334"
                  mode={mode}
                  timeSubMode={timeSubMode}
                  step={2}
                  dropTime={dropTime}
                  firstInterval={firstInterval}
                  height={height}
                  ratio={ratio}
                  visible={revealedAnswers.first || hasPlayed}
                />
              </>
            ) : (
              <>
                <text
                  x="321"
                  y="326"
                  textAnchor="middle"
                  className={`question-label ${animationPhase === 'pausedSecond' && !revealedAnswers.second ? 'show' : ''}`}
                >
                  ?
                </text>
                <SvgIntervalLabel
                  x="321"
                  y="334"
                  mode={mode}
                  timeSubMode={timeSubMode}
                  step={2}
                  dropTime={dropTime}
                  firstInterval={firstInterval}
                  height={height}
                  ratio={ratio}
                  visible={visibleIntervals.secondBounce}
                />
              </>
            )}

            {/* Position x=431 (3rd -> 4th bounce) */}
            {mode === 'time' && timeSubMode === 'interval' ? (
              <>
                <text
                  x="431"
                  y="326"
                  textAnchor="middle"
                  className={`question-label ${animationPhase === 'pausedSecond' && !revealedAnswers.second ? 'show' : ''}`}
                >
                  ?
                </text>
                <SvgIntervalLabel
                  x="431"
                  y="334"
                  mode={mode}
                  timeSubMode={timeSubMode}
                  step={3}
                  dropTime={dropTime}
                  firstInterval={firstInterval}
                  height={height}
                  ratio={ratio}
                  visible={revealedAnswers.second || hasPlayed}
                />
              </>
            ) : (
              <SvgIntervalLabel
                x="431"
                y="334"
                mode={mode}
                timeSubMode={timeSubMode}
                step={3}
                dropTime={dropTime}
                firstInterval={firstInterval}
                height={height}
                ratio={ratio}
                visible={visibleIntervals.thirdBounce}
              />
            )}

            <text x="555" y="176" textAnchor="middle" className={`dots ${revealState.dots ? 'show' : ''}`}>
              ...
            </text>
            <text x="671" y="326" textAnchor="middle" className={`question-label ${revealState.interval >= 5 ? 'show' : ''}`}>
              ?
            </text>
            <text x="156" y="366" textAnchor="middle" className={`bounce-label ${revealState.bounce >= 1 ? 'show' : ''}`}>
              1st
            </text>
            <text x="266" y="366" textAnchor="middle" className={`bounce-label ${revealState.bounce >= 2 ? 'show' : ''}`}>
              2nd
            </text>
            <text x="376" y="366" textAnchor="middle" className={`bounce-label ${revealState.bounce >= 3 ? 'show' : ''}`}>
              3rd
            </text>
            <text x="486" y="366" textAnchor="middle" className={`bounce-label ${revealState.bounce >= 4 ? 'show' : ''}`}>
              4th
            </text>
            <text x="626" y="366" textAnchor="middle" className={`bounce-label ${revealState.bounce >= 5 ? 'show' : ''}`}>
              (n-1)th
            </text>
            <text x="716" y="366" textAnchor="middle" className={`bounce-label ${revealState.bounce >= 6 ? 'show' : ''}`}>
              nth
            </text>
          </svg>
        </section>

        <section className={`guided-panel ${hasReachedFirstPause ? 'ready' : 'waiting'}`}>
          {!hasReachedFirstPause ? (
            <div className="waiting-card">
              <p className="eyebrow">Guided questions</p>
              <h2>{isRunning ? 'Watch the bounce carefully.' : 'Press START and watch the pattern first.'}</h2>
            </div>
          ) : !firstIntervalCorrect ? (
            <section className="question-card animated-card" key="q1">
              <p className="eyebrow">Question 1</p>
              <p className="given-line">
                {mode === 'time' && timeSubMode === 'interval' ? (
                  <>
                    1st bounce interval <InlineMath math="T_1" />: <InlineMath math={numericWork.baseText} /> s; time factor:{' '}
                    <InlineMath math={`r=${numericWork.rText}`} />
                  </>
                ) : (
                  <>
                    {mode === 'time' ? 'Time from release to first bounce' : 'Distance from release to first bounce'}:{' '}
                    <InlineMath math={numericWork.baseText} />
                    {mode === 'time' ? ' s' : ' m'}; factor: <InlineMath math={`r=${numericWork.rText}`} />
                  </>
                )}
              </p>
              <h2 className="question-prompt">
                {mode === 'time' && timeSubMode === 'interval'
                  ? 'What is the time taken (in sec) between the 2nd and 3rd bounce?'
                  : `What is the ${mode === 'time' ? 'time taken (in sec)' : 'distance travelled (in m)'} between the 1st and 2nd bounce?`}
              </h2>
              <div className="mcq-grid">
                {concreteIntervalOptions.first.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={`mcq-option ${firstIntervalChoice === option.id ? 'selected' : ''} ${
                      firstIntervalChoice === option.id && option.correct ? 'correct' : ''
                    } ${firstIntervalChoice === option.id && !option.correct ? 'wrong' : ''}`}
                    onClick={() => chooseFirstInterval(option)}
                  >
                    <WrappedFormula math={option.latex} />
                  </button>
                ))}
              </div>
            </section>
          ) : !hasReachedSecondPause ? (
            <div className="waiting-card animated-card" key="wait-q2">
              <p className="eyebrow">Guided questions</p>
              <h2>Watch the next bounce carefully.</h2>
            </div>
          ) : !secondIntervalCorrect ? (
            <section className="question-card animated-card" key="q2">
              <p className="eyebrow">Question 2</p>
              <h2 className="question-prompt">
                {mode === 'time' && timeSubMode === 'interval'
                  ? 'What is the time taken (in sec) between the 3rd and 4th bounce?'
                  : `What is the ${mode === 'time' ? 'time taken (in sec)' : 'distance travelled (in m)'} between the 2nd and 3rd bounce?`}
              </h2>
              <div className="mcq-grid">
                {concreteIntervalOptions.second.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={`mcq-option ${secondIntervalChoice === option.id ? 'selected' : ''} ${
                      secondIntervalChoice === option.id && option.correct ? 'correct' : ''
                    } ${secondIntervalChoice === option.id && !option.correct ? 'wrong' : ''}`}
                    onClick={() => chooseSecondInterval(option)}
                  >
                    <BlockMath math={option.latex} />
                  </button>
                ))}
              </div>
            </section>
          ) : !hasReachedNthPause ? (
            <div className="waiting-card animated-card" key="wait-general">
              <p className="eyebrow">Guided questions</p>
              <h2>Watch until the nth bounce.</h2>
            </div>
          ) : !mcqCorrect ? (
            <section className="question-card animated-card" key="q3">
              <p className="eyebrow">Question 3</p>
              <p className="given-line">
                {mode === 'time' && timeSubMode === 'interval' ? (
                  <>
                    1st bounce interval <InlineMath math="T_1" />: <InlineMath math={numericWork.baseText} /> s; time factor:{' '}
                    <InlineMath math={`r=${numericWork.rText}`} />
                  </>
                ) : (
                  <>
                    {mode === 'time' ? 'Time from release to first bounce' : 'Distance from release to first bounce'}:{' '}
                    <InlineMath math={numericWork.baseText} />
                    {mode === 'time' ? ' s' : ' m'}; factor: <InlineMath math={`r=${numericWork.rText}`} />
                  </>
                )}
              </p>
              <h2 className="question-prompt">
                {mode === 'time' && timeSubMode === 'interval'
                  ? 'What is the time taken between the n-th and (n+1)-th bounce?'
                  : `What is the ${mode === 'time' ? 'time taken' : 'distance travelled'} between the (n-1)th and nth bounce?`}
              </h2>
              <div className="mcq-grid">
                {mcqOptions.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={`mcq-option ${mcqChoice === option.id ? 'selected' : ''} ${
                      mcqChoice === option.id && option.correct ? 'correct' : ''
                    } ${mcqChoice === option.id && !option.correct ? 'wrong' : ''}`}
                    onClick={() => chooseMcq(option)}
                  >
                    <BlockMath math={option.latex} />
                  </button>
                ))}
              </div>
            </section>
          ) : !hasPlayed ? (
            <div className="waiting-card animated-card" key="wait-final">
              <p className="eyebrow">Guided questions</p>
              <h2>Watch the final bounce in the diagram.</h2>
            </div>
          ) : !setupCorrect ? (
            <section className="question-card animated-card" key="q4">
              <p className="eyebrow">Question 4</p>
              <h2>
                {mode === 'time' && timeSubMode === 'interval'
                  ? 'Which expression represents the total time from the 1st bounce to the nth bounce (S₁→ₙ)?'
                  : `Which expression represents the total ${mode} up to the nth bounce?`}
              </h2>
              <div className="mcq-grid stacked-options">
                {totalOptions.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={`mcq-option ${setupChoice === option.id ? 'selected' : ''} ${
                      setupChoice === option.id && option.correct ? 'correct' : ''
                    } ${setupChoice === option.id && !option.correct ? 'wrong' : ''}`}
                    onClick={() => chooseSetup(option)}
                  >
                    <BlockMath math={option.latex} />
                  </button>
                ))}
              </div>
            </section>
          ) : !termCountCorrect ? (
            <section className="question-card animated-card" key="q5">
              <p className="eyebrow">Question 5</p>
              <h2>How many terms are in the GP sum highlighted in yellow?</h2>
              <div className="math-stack term-checkpoint">
                <div className="formula-heading">
                  {mode === 'time' && timeSubMode === 'interval'
                    ? 'Total time taken from 1st to nth bounce (S₁→ₙ)'
                    : mode === 'time'
                      ? 'Total time taken till nth bounce'
                      : 'Total distance travelled till nth bounce'}
                </div>
                <div className="formula-row">
                  <InlineMath math={`=${numericWork.terms}`} />
                </div>
                <div className="formula-row">
                  {mode === 'time' && timeSubMode === 'interval' ? (
                    <>
                      <InlineMath math={`=${numericWork.baseText}[`} />
                      <span className="gp-highlight">
                        <InlineMath math={numericWork.bracketComplete} />
                      </span>
                      <InlineMath math={']'} />
                    </>
                  ) : (
                    <>
                      <InlineMath
                        math={`=${numericWork.baseText}+2(${numericWork.baseText})(${numericWork.firstPower})[`}
                      />
                      <span className="gp-highlight">
                        <InlineMath math={numericWork.bracketComplete} />
                      </span>
                      <InlineMath math={']'} />
                    </>
                  )}
                </div>
              </div>
              <div className="mcq-grid compact-mcq delayed-options">
                {termCountOptions.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={`mcq-option ${termCountChoice === option.id ? 'selected' : ''} ${
                      termCountChoice === option.id && option.correct ? 'correct' : ''
                    } ${termCountChoice === option.id && !option.correct ? 'wrong' : ''}`}
                    onClick={() => chooseTermCount(option)}
                  >
                    <BlockMath math={option.latex} />
                  </button>
                ))}
              </div>
            </section>
          ) : !conceptCorrect && !(mode === 'time' && timeSubMode === 'interval') ? (
            <section className="question-card animated-card" key="q6">
              <p className="eyebrow">Question 6</p>
              <div className="plain-formula-line">
                <span>
                  {mode === 'time' ? 'Total time taken' : 'Total distance travelled'}{' '}
                  ={' '}
                </span>
                <InlineMath math={numericWork.terms} />
              </div>
              <h2>Why should we not apply the GP sum formula directly to the whole expression?</h2>
              <div className="concept-grid">
                {conceptOptions.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={`mcq-option concept-option ${conceptChoice === option.id ? 'selected' : ''} ${
                      conceptChoice === option.id && option.correct ? 'correct' : ''
                    } ${conceptChoice === option.id && !option.correct ? 'wrong' : ''}`}
                    onClick={() => chooseConcept(option)}
                  >
                    {option.text}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="question-card animated-card" key="q7">
              <p className="eyebrow">
                {mode === 'time' && timeSubMode === 'interval' ? 'Question 6' : 'Question 7'}
              </p>
              <div className="plain-formula-line">
                <span>
                  {mode === 'time' && timeSubMode === 'interval'
                    ? 'Total time (1st to nth bounce)'
                    : mode === 'time'
                      ? 'Total time taken'
                      : 'Total distance travelled'}{' '}
                  ={' '}
                </span>
                <InlineMath math={numericWork.terms} />
              </div>
              <h2>
                {mode === 'time' && timeSubMode === 'interval'
                  ? 'What is the final simplified total time formula from the 1st bounce to the nth bounce (S₁→ₙ)?'
                  : 'What is the final simplified expression in terms of n?'}
              </h2>
              <div className="mcq-grid">
                {finalOptions.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={`mcq-option ${finalChoice === option.id ? 'selected' : ''} ${
                      finalChoice === option.id && option.correct ? 'correct' : ''
                    } ${finalChoice === option.id && !option.correct ? 'wrong' : ''}`}
                    onClick={() => chooseTotal(option)}
                  >
                    <BlockMath math={option.latex} />
                  </button>
                ))}
              </div>
            </section>
          )}
        </section>
      </div>

      {answerPopup && (
        <div className="answer-modal-backdrop" role="dialog" aria-modal="true" aria-live="assertive">
          <div className={`answer-modal ${answerPopup.correct ? 'correct' : 'wrong'}`}>
            <p className="eyebrow">{answerPopup.correct ? 'Correct' : 'Try again'}</p>
            <h2>
              {answerPopup.correct && answerPopup.checkpoint === 'final'
                ? 'Well done!'
                : answerPopup.correct
                  ? 'Good thinking.'
                  : 'Not quite yet.'}
            </h2>
            <p>{answerPopup.message}</p>
            <button type="button" onClick={dismissAnswerPopup}>
              OK
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

export default App
