import React from 'react';
import { motion } from 'framer-motion';

interface SocialLoginButtonProps {
  type: 'wechat' | 'xiaohongshu'; // Removed 'douyin' - migrating away from Douyin platform
  onClick?: () => void;
  className?: string;
}

const socialConfig = {
  wechat: {
    name: '微信',
    bgColor: 'bg-green-500',
    hoverColor: 'hover:bg-green-600',
    icon: '💬'
  },
  xiaohongshu: {
    name: '小红书',
    bgColor: 'bg-red-500',
    hoverColor: 'hover:bg-red-600',
    icon: '📖'
  }
  // Removed douyin config - migrating away from Douyin platform
};

export const SocialLoginButton: React.FC<SocialLoginButtonProps> = ({
  type,
  onClick,
  className = ''
}) => {
  const config = socialConfig[type];

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`
        w-full h-12 rounded-xl border border-gray-200 
        ${config.hoverColor} hover:border-transparent
        flex items-center justify-center
        transition-all duration-200
        ${className}
      `}
    >
      <div className={`
        w-6 h-6 ${config.bgColor} rounded-md 
        flex items-center justify-center text-white text-sm
      `}>
        {config.icon}
      </div>
    </motion.button>
  );
};
