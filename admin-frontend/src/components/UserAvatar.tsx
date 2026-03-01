import React from 'react'
import { Avatar } from 'antd'
import type { AvatarProps } from 'antd'

export interface UserAvatarProps extends AvatarProps {
  src?: string
  alt?: string
  fallback?: string
  size?: 'small' | 'default' | 'large' | number
  className?: string
}

const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  alt = '用户头像',
  fallback,
  size = 'default',
  className = '',
  ...props
}) => {
  // 如果src是像素艺术数据（逗号分隔的颜色代码）
  const isPixelArt = src && typeof src === 'string' && src.includes(',') && src.split(',').every(color =>
    color.trim().startsWith('#') || /^#[0-9A-F]{6}$/i.test(color.trim())
  )

  // 生成默认头像内容
  const getDefaultAvatar = () => {
    if (fallback) {
      return fallback.charAt(0).toUpperCase()
    }
    return alt ? alt.charAt(0).toUpperCase() : 'U'
  }

  // 如果是像素艺术数据，生成CSS样式
  if (isPixelArt) {
    const colors = src.split(',').map(c => c.trim())
    const pixelSize = typeof size === 'number' ? size : (
      size === 'large' ? 64 : size === 'small' ? 24 : 32
    )
    const gridSize = Math.ceil(Math.sqrt(colors.length))
    const cellSize = pixelSize / gridSize

    const pixelStyle = {
      width: pixelSize,
      height: pixelSize,
      display: 'grid',
      gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
      gridTemplateRows: `repeat(${gridSize}, 1fr)`,
      gap: 0,
      borderRadius: '50%',
      overflow: 'hidden'
    }

    const pixelContent = colors.slice(0, gridSize * gridSize).map((color, index) => (
      <div
        key={index}
        style={{
          backgroundColor: color,
          width: cellSize,
          height: cellSize
        }}
      />
    ))

    return (
      <div
        className={`user-avatar-pixel ${className}`}
        style={pixelStyle}
        title={alt}
      >
        {pixelContent}
      </div>
    )
  }

  return (
    <Avatar
      src={src}
      size={size}
      className={`user-avatar ${className}`}
      alt={alt}
      {...props}
    >
      {getDefaultAvatar()}
    </Avatar>
  )
}

export default UserAvatar