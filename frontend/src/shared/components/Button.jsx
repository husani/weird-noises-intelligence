/**
 * Button component.
 * @param {'primary'|'secondary'|'ghost'} variant - Visual style.
 *   - primary: warm accent background, used for main actions
 *   - secondary: elevated background with border, used for secondary actions
 *   - ghost: transparent, used for tertiary actions
 */

import React from 'react'

export default function Button({ variant = 'primary', children, className = '', ...props }) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...props}>
      {children}
    </button>
  )
}
