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

export const DownloadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 4v11.5" />
    <path d="m7.5 11 4.5 4.5L16.5 11" />
    <path d="M4.5 17.5V19A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-1.5" />
  </Icon>
)
