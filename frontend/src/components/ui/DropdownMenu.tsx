import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';

interface DropdownMenuProps {
  children: React.ReactNode;
  trigger: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  children,
  trigger,
  align = 'end',
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const alignClasses = {
    start: 'left-0',
    center: 'left-1/2 transform -translate-x-1/2',
    end: 'right-0'
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute top-full mt-1 z-50 min-w-[8rem] bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden',
              alignClasses[align],
              className
            )}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const DropdownMenuTrigger: React.FC<{ 
  asChild?: boolean; 
  children: React.ReactNode;
}> = ({ asChild, children }) => {
  return <>{children}</>;
};

export const DropdownMenuContent: React.FC<{ 
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}> = ({ children, align, className }) => {
  return <>{children}</>;
};

export const DropdownMenuItem: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}> = ({ children, onClick, className }) => {
  return (
    <div
      className={cn(
        'px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition-colors',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
