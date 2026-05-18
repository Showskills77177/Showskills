import { Link } from 'react-router-dom'
import showskillsLogo from '../assets/showskills-logo.png'

const maskStyle = {
  maskImage: `url(${showskillsLogo})`,
  WebkitMaskImage: `url(${showskillsLogo})`,
  maskSize: 'contain',
  WebkitMaskSize: 'contain',
  maskRepeat: 'no-repeat',
  WebkitMaskRepeat: 'no-repeat',
  maskPosition: 'center',
  WebkitMaskPosition: 'center',
}

export function AdminLogo({ className = '', linkTo = '/admin/dashboard', size = 'md' }) {
  const height = size === 'sm' ? 'h-8' : size === 'lg' ? 'h-12' : 'h-10'
  const mark = (
    <div
      role="img"
      aria-label="ShowSkills Rewards"
      className={`${height} w-auto shrink-0 bg-stone-100 [aspect-ratio:745/235] ${className}`}
      style={maskStyle}
    />
  )

  if (linkTo == null) {
    return mark
  }

  return (
    <Link
      to={linkTo}
      className="inline-flex shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950"
    >
      {mark}
    </Link>
  )
}
