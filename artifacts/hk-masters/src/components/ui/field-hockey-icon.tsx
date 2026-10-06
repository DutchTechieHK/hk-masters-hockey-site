import type { SVGProps } from "react"

export function FieldHockeyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M16 3 7 17a3 3 0 0 0 5 3l1-1.5" />
      <circle cx="19" cy="18" r="2" />
    </svg>
  )
}
