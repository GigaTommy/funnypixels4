import React from 'react';
import { cn } from '../../utils/cn';

interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  fallback,
  size = 'md',
  className
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg'
  };

  const [imageError, setImageError] = React.useState(false);

  return (
    <div className={cn(
      'relative inline-flex items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-white font-semibold overflow-hidden',
      sizeClasses[size],
      className
    )}>
      {src && !imageError ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <span>{fallback || alt.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
};

export const AvatarImage: React.FC<{ src?: string; alt?: string; className?: string }> = ({
  src,
  alt,
  className
}) => {
  return (
    <img
      src={src}
      alt={alt}
      className={cn('w-full h-full object-cover', className)}
    />
  );
};

export const AvatarFallback: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className
}) => {
  return (
    <span className={cn('w-full h-full flex items-center justify-center', className)}>
      {children}
    </span>
  );
};
