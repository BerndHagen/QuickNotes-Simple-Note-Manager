/**
 * The application canvas: four curved bands rising out of the bottom-left
 * corner over a pale field.
 *
 * The motion is a path morph, not a transform. Translating the shapes moved
 * their anchored edges too, which opened gaps along the left and bottom where
 * the bare field showed through. Every keyframe below therefore starts on the
 * left edge (`M0 …`) and closes along the bottom (`L1600 900 L0 900 Z`), so
 * those two edges stay welded to the viewport while only the crest travels.
 *
 * Each band is interpolated by its own <animate>, at a different duration and
 * with an ease-in-out spline, so the crests drift apart and back together
 * rather than sliding as one block. `preserveAspectRatio="none"` stretches the
 * composition to any window instead of letter-boxing it.
 *
 * Colours live in index.css next to the rest of the canvas.
 */

// Ease-in-out for each leg of the loop.
const SPLINE = '0.42 0 0.58 1'
const KEY_TIMES = '0;0.34;0.67;1'
const KEY_SPLINES = `${SPLINE};${SPLINE};${SPLINE}`

const BANDS = [
  {
    className: 'qn-wave qn-wave--d',
    dur: '19s',
    frames: [
      'M0 250 C 300 438 668 622 1040 712 C 1250 762 1440 788 1600 800 L1600 900 L0 900 Z',
      'M0 272 C 336 476 706 652 1066 730 C 1276 774 1452 796 1600 808 L1600 900 L0 900 Z',
      'M0 236 C 272 410 636 600 1016 698 C 1228 750 1430 780 1600 792 L1600 900 L0 900 Z',
    ],
  },
  {
    className: 'qn-wave qn-wave--c',
    dur: '23s',
    frames: [
      'M0 396 C 268 552 588 704 916 786 C 1140 842 1390 872 1600 884 L1600 900 L0 900 Z',
      'M0 414 C 300 580 622 728 942 802 C 1164 854 1404 880 1600 890 L1600 900 L0 900 Z',
      'M0 382 C 242 530 558 684 892 772 C 1118 832 1376 866 1600 878 L1600 900 L0 900 Z',
    ],
  },
  {
    className: 'qn-wave qn-wave--b',
    dur: '29s',
    frames: [
      'M0 540 C 214 654 470 772 742 838 C 966 892 1240 900 1420 900 L1600 900 L0 900 Z',
      'M0 558 C 240 678 498 790 766 850 C 986 898 1256 900 1432 900 L1600 900 L0 900 Z',
      'M0 526 C 194 634 448 756 722 828 C 950 886 1226 900 1408 900 L1600 900 L0 900 Z',
    ],
  },
  {
    className: 'qn-wave qn-wave--a',
    dur: '35s',
    frames: [
      'M0 674 C 164 748 368 822 578 868 C 716 898 850 900 952 900 L1600 900 L0 900 Z',
      'M0 690 C 184 766 390 836 598 878 C 732 900 866 900 966 900 L1600 900 L0 900 Z',
      'M0 660 C 148 734 350 810 560 858 C 702 892 838 900 940 900 L1600 900 L0 900 Z',
    ],
  },
]

export default function CanvasWaves() {
  return (
    <div className="qn-canvas-waves" aria-hidden="true">
      <svg viewBox="0 0 1600 900" preserveAspectRatio="none" focusable="false">
        {BANDS.map(({ className, dur, frames }) => (
          <path key={className} className={className} d={frames[0]}>
            <animate
              attributeName="d"
              dur={dur}
              repeatCount="indefinite"
              calcMode="spline"
              keyTimes={KEY_TIMES}
              keySplines={KEY_SPLINES}
              values={`${frames[0]};${frames[1]};${frames[2]};${frames[0]}`}
            />
          </path>
        ))}
      </svg>
    </div>
  )
}
