/**
 * Original line icons drawn on a 24×24 grid with a 1.6 stroke, so they sit
 * comfortably beside the app's rounded, soft-edged surfaces.
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      width="1em"
      height="1em"
      {...props}
    >
      {children}
    </svg>
  )
}

export const PlayIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 5.6a.8.8 0 0 1 1.22-.68l9.1 5.68a.8.8 0 0 1 0 1.36l-9.1 5.68A.8.8 0 0 1 8 17.02Z" fill="currentColor" stroke="none" />
  </Icon>
)

export const PauseIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="7" y="5" width="3.6" height="14" rx="1.6" fill="currentColor" stroke="none" />
    <rect x="13.4" y="5" width="3.6" height="14" rx="1.6" fill="currentColor" stroke="none" />
  </Icon>
)

export const StopIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="6" y="6" width="12" height="12" rx="3.2" fill="currentColor" stroke="none" />
  </Icon>
)

export const SeedIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3c3.6 2.2 5.6 5.2 5.6 8.6A5.6 5.6 0 0 1 12 17.2a5.6 5.6 0 0 1-5.6-5.6C6.4 8.2 8.4 5.2 12 3Z" />
    <path d="M12 21v-5.4" />
  </Icon>
)

export const LeafIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 19c0-7.2 4.6-11.4 14-12-.4 9.4-4.6 14-11.6 14H5Z" />
    <path d="M9 15.5c1.8-2.6 4.2-4.6 7.2-6" />
  </Icon>
)

export const SparkIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3.5c.7 4.2 1.8 5.3 6 6-4.2.7-5.3 1.8-6 6-.7-4.2-1.8-5.3-6-6 4.2-.7 5.3-1.8 6-6Z" />
    <path d="M18.6 15.4c.3 1.6.7 2 2.4 2.3-1.7.3-2.1.7-2.4 2.3-.3-1.6-.7-2-2.4-2.3 1.7-.3 2.1-.7 2.4-2.3Z" />
  </Icon>
)

export const MoonIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2Z" />
  </Icon>
)

export const SunIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.6v2M12 19.4v2M2.6 12h2M19.4 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
  </Icon>
)

/* A painter's palette — the hue dial, and nothing else. */
export const PaletteIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3.8a8.2 8.2 0 0 0 0 16.4c1.2 0 1.9-.8 1.9-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8h1.4a4.1 4.1 0 0 0 4.1-4.1c0-3.5-3.7-6.3-8.2-6.3Z" />
    <circle cx="8" cy="11.2" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="11.4" cy="7.9" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15.8" cy="9.6" r="1.1" fill="currentColor" stroke="none" />
  </Icon>
)

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.5 7h15M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
    <path d="M6.5 7l.8 11.2A1.8 1.8 0 0 0 9.1 20h5.8a1.8 1.8 0 0 0 1.8-1.8L17.5 7" />
  </Icon>
)

export const CopyIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="9" y="9" width="11" height="11" rx="3" />
    <path d="M15 5.5A1.5 1.5 0 0 0 13.5 4H7a3 3 0 0 0-3 3v6.5A1.5 1.5 0 0 0 5.5 15" />
  </Icon>
)

/** A clipboard — copying the words themselves, not the loop. */
export const ClipboardIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9.2 5H7.4A2.4 2.4 0 0 0 5 7.4v10.2A2.4 2.4 0 0 0 7.4 20h9.2a2.4 2.4 0 0 0 2.4-2.4V7.4A2.4 2.4 0 0 0 16.6 5h-1.8" />
    <rect x="9.2" y="3.2" width="5.6" height="3.4" rx="1.5" />
  </Icon>
)

/** Three quiet dots — everything else this thing can do. */
export const MoreIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="5.6" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="18.4" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </Icon>
)

export const PencilIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.5 19.5h3.2L18.9 8.3a2.3 2.3 0 0 0-3.2-3.2L4.5 16.3Z" />
    <path d="M14.4 6.4l3.2 3.2" />
  </Icon>
)

export const ChevronIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6.5 9.5 12 15l5.5-5.5" />
  </Icon>
)

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m5 12.6 4.6 4.6L19 6.8" />
  </Icon>
)

export const UploadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 16V4.5" />
    <path d="m7.5 9 4.5-4.5L16.5 9" />
    <path d="M4.5 15v2.5A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5V15" />
  </Icon>
)

export const ArrowUpIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 19V5" />
    <path d="m6 11 6-6 6 6" />
  </Icon>
)

export const ArrowDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5v14" />
    <path d="m6 13 6 6 6-6" />
  </Icon>
)

export const ShareIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 15V3.8" />
    <path d="m8.4 7.2 3.6-3.4 3.6 3.4" />
    <path d="M6 11H5.2A1.2 1.2 0 0 0 4 12.2v7.6A1.2 1.2 0 0 0 5.2 21h13.6a1.2 1.2 0 0 0 1.2-1.2v-7.6A1.2 1.2 0 0 0 18.8 11H18" />
  </Icon>
)

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
  </Icon>
)

/** Four corners pushed outward — grow the stage to fill the screen. */
export const ExpandIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M14.2 4.5h5.3v5.3M9.8 19.5H4.5v-5.3" />
    <path d="m19.5 4.5-6 6M4.5 19.5l6-6" />
  </Icon>
)

/** The same corners drawn back in — return to the page. */
export const CollapseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M19.5 9.8h-5.3V4.5M4.5 14.2h5.3v5.3" />
    <path d="m14.2 9.8 5.3-5.3M9.8 14.2l-5.3 5.3" />
  </Icon>
)

export const InfoIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 11v5.2M12 7.9v.2" />
  </Icon>
)

export const WaveIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 12c1.6-3.4 3.2-3.4 4.8 0s3.2 3.4 4.8 0 3.2-3.4 4.8 0" />
    <path d="M4 17c1.6-2.2 3.2-2.2 4.8 0s3.2 2.2 4.8 0 3.2-2.2 4.8 0" opacity=".55" />
  </Icon>
)

/** The same wave, struck through — background sound turned off. */
export const MuteIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 12c1.6-3.4 3.2-3.4 4.8 0s3.2 3.4 4.8 0 3.2-3.4 4.8 0" opacity=".55" />
    <path d="M5 19 19 5" />
  </Icon>
)

export const DownloadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 4v11.5" />
    <path d="m7.5 11 4.5 4.5L16.5 11" />
    <path d="M4.5 17.5V19A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-1.5" />
  </Icon>
)

/** Speech leaving a mouth — the voice setting. */
export const VoiceIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 9.5v5M8.5 6.5v11M12 8v8" />
    <path d="M15.8 9.4a4.2 4.2 0 0 1 0 5.2" />
    <path d="M18.6 6.8a8 8 0 0 1 0 10.4" opacity=".6" />
  </Icon>
)

export const ClockIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 7.6V12l3 1.8" />
  </Icon>
)

/** Concentric breath rings — the breathing guide. */
export const BreathIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="3" />
    <circle cx="12" cy="12" r="6.4" opacity=".62" />
    <circle cx="12" cy="12" r="9.4" opacity=".3" />
  </Icon>
)

export const MicIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="9" y="3" width="6" height="10.6" rx="3" />
    <path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0" />
    <path d="M12 17.8V21" />
  </Icon>
)

/** Sliders — haptics and interface sound. */
export const TuneIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 6h14M5 12h14M5 18h14" />
    <circle cx="9.5" cy="6" r="2.1" fill="var(--panel-solid)" />
    <circle cx="15" cy="12" r="2.1" fill="var(--panel-solid)" />
    <circle cx="8" cy="18" r="2.1" fill="var(--panel-solid)" />
  </Icon>
)

/** A slow rhythmic trace — the brainwave rhythm. */
export const PulseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.8 12h2.6l1.5-4.4 2.4 8.8 2.4-9.6 2.4 9.6 1.5-4.4h2.6" />
  </Icon>
)

/** Over-ear headphones — the binaural requirement. */
export const HeadphonesIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.6 14.4v-1.9a7.4 7.4 0 0 1 14.8 0v1.9" />
    <rect x="2.8" y="13.6" width="3.6" height="6.2" rx="1.8" />
    <rect x="17.6" y="13.6" width="3.6" height="6.2" rx="1.8" />
  </Icon>
)

/** A gently opening flower — the Create tab. */
export const BloomIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 12c0-3.4 1.6-6 3.6-6S19 8 19 10.4c0 2-1.6 3.4-3.4 3.4" />
    <path d="M12 12c0-3.4-1.6-6-3.6-6S5 8 5 10.4c0 2 1.6 3.4 3.4 3.4" />
    <path d="M12 12v9" />
  </Icon>
)
