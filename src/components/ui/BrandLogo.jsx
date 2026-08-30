import editorLogo from '../../../images/quicknotes-editor-logo.png'

export default function BrandLogo({ alt = '', className = '', ...props }) {
  return (
    <img
      src={editorLogo}
      alt={alt}
      aria-hidden={alt ? undefined : 'true'}
      className={`block shrink-0 object-contain ${className}`}
      draggable="false"
      {...props}
    />
  )
}
