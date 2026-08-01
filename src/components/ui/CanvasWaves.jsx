/**
 * The application canvas: four curved bands rising out of the bottom-left
 * corner over a pale field.
 *
 * The bands are real geometry rather than stacked gradients, because a
 * gradient cannot produce the crossing curves the design calls for. The
 * viewBox is stretched with `preserveAspectRatio="none"` so the composition
 * keeps its proportions relative to the window instead of letter-boxing on a
 * wide monitor, and each band drifts on its own cycle so the movement never
 * resolves into a single visible loop.
 *
 * Colours and motion live in index.css next to the rest of the canvas.
 */
export default function CanvasWaves() {
  return (
    <div className="qn-canvas-waves" aria-hidden="true">
      <svg viewBox="0 0 1600 900" preserveAspectRatio="none" focusable="false">
        <path
          className="qn-wave qn-wave--d"
          d="M0 250 C 300 438 668 622 1040 712 C 1250 762 1440 788 1600 800 L1600 900 L0 900 Z"
        />
        <path
          className="qn-wave qn-wave--c"
          d="M0 396 C 268 552 588 704 916 786 C 1140 842 1390 872 1600 884 L1600 900 L0 900 Z"
        />
        <path
          className="qn-wave qn-wave--b"
          d="M0 540 C 214 654 470 772 742 838 C 966 892 1240 900 1420 900 L0 900 Z"
        />
        <path
          className="qn-wave qn-wave--a"
          d="M0 674 C 164 748 368 822 578 868 C 716 898 850 900 952 900 L0 900 Z"
        />
      </svg>
    </div>
  )
}
