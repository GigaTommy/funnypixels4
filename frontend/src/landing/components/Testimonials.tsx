import React from 'react';
import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

const Testimonials: React.FC = () => {
  const testimonials = [
    {
      name: '张三',
      title: '每日跑步爱好者',
      avatar: '🏃',
      rating: 5,
      content: '这个游戏让我的晨跑变得更有意思了！每天看着地图上自己绘制的像素越来越多，特别有成就感。现在跑步再也不无聊了！',
      location: '北京',
      stats: '已绘制 50,000+ 像素',
    },
    {
      name: '李四',
      title: '联盟创始人',
      avatar: '👑',
      rating: 5,
      content: '和朋友们一起创建联盟，一起占领城市，太刺激了！我们联盟已经拿下了整个杭州市区，下一个目标是上海！',
      location: '杭州',
      stats: '联盟成员 200+',
    },
    {
      name: '王五',
      title: '减肥成功者',
      avatar: '💪',
      rating: 5,
      content: '用FunnyPixels三个月，不知不觉减了15斤！游戏化的运动方式让我坚持了下来，现在每天都期待着出门"画画"。',
      location: '上海',
      stats: '减重 15 斤',
    },
    {
      name: '赵六',
      title: '旅行摄影师',
      avatar: '📸',
      rating: 5,
      content: '出差旅行的时候也能玩，每到一个新城市就能在地图上留下自己的印记。现在我的像素足迹遍布全国50多个城市！',
      location: '深圳',
      stats: '50+ 城市',
    },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-white to-gray-50 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 right-10 w-64 h-64 bg-yellow-200 rounded-full opacity-10 blur-3xl"></div>
        <div className="absolute bottom-1/4 left-10 w-64 h-64 bg-blue-200 rounded-full opacity-10 blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-block mb-4">
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-full text-sm font-bold">
              用户好评
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-gray-900 mb-4">
            玩家们怎么说
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            超过 10万+ 玩家的真实评价
          </p>
        </motion.div>

        {/* 评价卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -5 }}
              className="relative bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300"
            >
              {/* 引号装饰 */}
              <div className="absolute top-6 right-6 text-purple-200">
                <Quote className="w-12 h-12" fill="currentColor" />
              </div>

              {/* 星级评分 */}
              <div className="flex items-center gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>

              {/* 评价内容 */}
              <p className="text-gray-700 leading-relaxed mb-6 relative z-10">
                "{testimonial.content}"
              </p>

              {/* 用户信息 */}
              <div className="flex items-center gap-4">
                {/* 头像 */}
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-2xl shadow-lg">
                    {testimonial.avatar}
                  </div>
                </div>

                {/* 信息 */}
                <div className="flex-1">
                  <div className="font-bold text-gray-900">{testimonial.name}</div>
                  <div className="text-sm text-gray-600">{testimonial.title}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    📍 {testimonial.location} · {testimonial.stats}
                  </div>
                </div>
              </div>

              {/* 装饰性背景 */}
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100 to-pink-100 rounded-tl-full opacity-20"></div>
            </motion.div>
          ))}
        </div>

        {/* 总体评分 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-8 bg-gradient-to-r from-purple-50 to-pink-50 px-12 py-6 rounded-2xl border border-purple-200">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-5xl font-black text-gray-900">4.8</span>
                <Star className="w-8 h-8 fill-yellow-400 text-yellow-400" />
              </div>
              <div className="text-sm text-gray-600">App Store 评分</div>
            </div>

            <div className="w-px h-12 bg-gray-300"></div>

            <div className="text-center">
              <div className="text-5xl font-black text-gray-900 mb-2">10W+</div>
              <div className="text-sm text-gray-600">全球下载量</div>
            </div>

            <div className="w-px h-12 bg-gray-300"></div>

            <div className="text-center">
              <div className="text-5xl font-black text-gray-900 mb-2">98%</div>
              <div className="text-sm text-gray-600">好评率</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Testimonials;
