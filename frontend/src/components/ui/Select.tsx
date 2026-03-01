import React, { useState } from 'react';

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
}

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

interface SelectTriggerProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

interface SelectValueProps {
  placeholder?: string;
  className?: string;
}

export const Select: React.FC<SelectProps> = ({
  value = '',
  onValueChange,
  placeholder,
  className = '',
  disabled = false,
  children
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value);

  const handleItemClick = (itemValue: string) => {
    setSelectedValue(itemValue);
    if (onValueChange) {
      onValueChange(itemValue);
    }
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <div
        className={`w-full px-3 py-2 border border-gray-300 rounded-md cursor-pointer ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-gray-400'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        {selectedValue || placeholder}
      </div>
      {isOpen && !disabled && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child) && child.type === SelectContent) {
              return React.cloneElement(child, { onItemClick: handleItemClick });
            }
            return child;
          })}
        </div>
      )}
    </div>
  );
};

export const SelectContent: React.FC<SelectContentProps & { onItemClick?: (value: string) => void }> = ({
  children,
  className = '',
  onItemClick
}) => {
  return (
    <div className={`py-1 ${className}`}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type === SelectItem) {
          return React.cloneElement(child, { onClick: () => onItemClick?.(child.props.value) });
        }
        return child;
      })}
    </div>
  );
};

export const SelectItem: React.FC<SelectItemProps & { onClick?: () => void }> = ({
  value,
  children,
  className = '',
  onClick
}) => {
  return (
    <div
      className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export const SelectTrigger: React.FC<SelectTriggerProps> = ({
  children,
  className = '',
  onClick
}) => {
  return (
    <div className={className} onClick={onClick}>
      {children}
    </div>
  );
};

export const SelectValue: React.FC<SelectValueProps> = ({
  placeholder,
  className = ''
}) => {
  return (
    <span className={className}>
      {placeholder}
    </span>
  );
};
