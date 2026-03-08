import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Twitter, MessageCircle, Mail } from 'lucide-react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 主内容区 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Logo和简介 */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                <span className="text-2xl font-bold">FP</span>
              </div>
              <span className="text-2xl font-bold">FunnyPixels</span>
            </div>
            <p className="text-gray-400 mb-6 max-w-md">
              边走边画，用脚步绘制世界。一款结合GPS定位的运动像素游戏，让运动更有趣，让创作更简单。
            </p>
            {/* 社交媒体链接 */}
            <div className="flex gap-4">
              <a
                href="https://twitter.com/funnypixels"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gray-800 hover:bg-blue-500 rounded-lg flex items-center justify-center transition-colors duration-300"
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="https://github.com/funnypixels"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors duration-300"
                aria-label="GitHub"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="https://discord.gg/funnypixels"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gray-800 hover:bg-indigo-500 rounded-lg flex items-center justify-center transition-colors duration-300"
                aria-label="Discord"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
              <a
                href="mailto:support@funnypixelsapp.com"
                className="w-10 h-10 bg-gray-800 hover:bg-red-500 rounded-lg flex items-center justify-center transition-colors duration-300"
                aria-label="Email"
              >
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* 快速链接 */}
          <div>
            <h3 className="font-semibold text-lg mb-4">快速链接</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/app"
                  className="text-gray-400 hover:text-white transition-colors duration-300"
                >
                  立即试玩
                </Link>
              </li>
              <li>
                <a
                  href="#features"
                  className="text-gray-400 hover:text-white transition-colors duration-300"
                >
                  功能介绍
                </a>
              </li>
              <li>
                <a
                  href="#how-it-works"
                  className="text-gray-400 hover:text-white transition-colors duration-300"
                >
                  玩法说明
                </a>
              </li>
              <li>
                <Link
                  to="/support"
                  className="text-gray-400 hover:text-white transition-colors duration-300"
                >
                  帮助中心
                </Link>
              </li>
            </ul>
          </div>

          {/* 法律信息 */}
          <div>
            <h3 className="font-semibold text-lg mb-4">法律信息</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/privacy-policy"
                  className="text-gray-400 hover:text-white transition-colors duration-300"
                >
                  隐私政策
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="text-gray-400 hover:text-white transition-colors duration-300"
                >
                  服务条款
                </Link>
              </li>
              <li>
                <a
                  href="mailto:legal@funnypixelsapp.com"
                  className="text-gray-400 hover:text-white transition-colors duration-300"
                >
                  法律咨询
                </a>
              </li>
              <li>
                <a
                  href="mailto:support@funnypixelsapp.com"
                  className="text-gray-400 hover:text-white transition-colors duration-300"
                >
                  联系我们
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* 分隔线 */}
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            {/* 版权信息 */}
            <p className="text-gray-400 text-sm">
              © {currentYear} FunnyPixels. All rights reserved.
            </p>

            {/* 额外信息 */}
            <div className="flex gap-6 text-sm text-gray-400">
              <span>Made with ❤️ for Runners</span>
              <span>·</span>
              <span>Version 1.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
