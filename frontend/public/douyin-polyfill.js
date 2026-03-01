/**
 * 抖音小游戏 instanceof 紧急修复脚本
 * 必须在所有其他脚本之前加载
 */

(function() {
  'use strict';

  console.log('🔧 [POLYFILL] 开始修复 instanceof 问题...');

  // 安全创建构造函数 - 确保构造函数永远是有效对象
  function createConstructor(name) {
    try {
      // 检查是否已存在有效的构造函数
      var existing = globalThis[name];
      if (typeof existing === 'function' && existing !== null && existing !== undefined) {
        console.log('✅ [POLYFILL]', name, '已存在');
        return;
      }

      // 创建构造函数（使用命名函数，确保有正确的prototype）
      var Ctor = (function() {
        var fn = function() {};
        Object.defineProperty(fn, 'name', {
          value: name,
          writable: false,
          enumerable: false,
          configurable: true
        });
        return fn;
      })();

      // 确保prototype是有效对象
      Ctor.prototype = Object.create(Object.prototype);
      Ctor.prototype.constructor = Ctor;

      // 添加toString方法
      Ctor.prototype.toString = function() {
        return '[object ' + name + ']';
      };

      // 赋值到全局对象
      globalThis[name] = Ctor;

      // 验证创建成功
      if (typeof globalThis[name] !== 'function') {
        throw new Error('创建 ' + name + ' 失败：不是函数');
      }

      console.log('✅ [POLYFILL] 创建', name);
    } catch (error) {
      console.error('❌ [POLYFILL] 创建', name, '失败:', error);
    }
  }

  // React 18调度器关键构造函数
  var constructors = [
    // 消息通道（React调度器核心）
    'MessageChannel',
    'MessagePort',
    'MessageEvent',

    // 基础DOM
    'EventTarget',
    'Node',
    'Element',
    'HTMLElement',
    'Text',
    'Comment',
    'DocumentFragment',
    'Document',
    'CharacterData',
    'Attr',

    // 事件
    'Event',
    'CustomEvent',
    'ErrorEvent',
    'ProgressEvent',
    'UIEvent',
    'MouseEvent',
    'KeyboardEvent',
    'TouchEvent',
    'PointerEvent',
    'WheelEvent',
    'DragEvent',
    'FocusEvent',
    'InputEvent',
    'ClipboardEvent',
    'AnimationEvent',
    'TransitionEvent',
    'HashChangeEvent',
    'PageTransitionEvent',
    'PopStateEvent',
    'StorageEvent',

    // HTML元素
    'HTMLDivElement',
    'HTMLSpanElement',
    'HTMLCanvasElement',
    'HTMLImageElement',
    'HTMLInputElement',
    'HTMLButtonElement',
    'HTMLFormElement',
    'HTMLTextAreaElement',
    'HTMLSelectElement',
    'HTMLOptionElement',
    'HTMLAnchorElement',
    'HTMLParagraphElement',
    'HTMLHeadingElement',

    // 其他
    'DOMException',
    'AbortController',
    'AbortSignal',
    'Blob',
    'File',
    'FileReader',
    'FormData',
    'Headers',
    'Request',
    'Response',
    'URL',
    'URLSearchParams',
    'Worker',
    'SharedWorker'
  ];

  // 批量创建
  for (var i = 0; i < constructors.length; i++) {
    createConstructor(constructors[i]);
  }

  // MessageChannel 完整实现（React 18调度器专用）
  try {
    var OriginalMessageChannel = globalThis.MessageChannel;

    // 重写MessageChannel构造函数
    globalThis.MessageChannel = function MessageChannel() {
      var channel = this;

      // 创建port1和port2，使用闭包实现消息传递
      var port1 = {
        onmessage: null,
        _otherPort: null,
        postMessage: function(data) {
          var self = this;
          // 使用setTimeout确保异步执行
          setTimeout(function() {
            if (self._otherPort && typeof self._otherPort.onmessage === 'function') {
              self._otherPort.onmessage({ data: data });
            }
          }, 0);
        },
        start: function() {},
        close: function() {}
      };

      var port2 = {
        onmessage: null,
        _otherPort: null,
        postMessage: function(data) {
          var self = this;
          setTimeout(function() {
            if (self._otherPort && typeof self._otherPort.onmessage === 'function') {
              self._otherPort.onmessage({ data: data });
            }
          }, 0);
        },
        start: function() {},
        close: function() {}
      };

      // 互相引用
      port1._otherPort = port2;
      port2._otherPort = port1;

      // 设置原型链（确保instanceof检查通过）
      if (globalThis.MessagePort && globalThis.MessagePort.prototype) {
        try {
          Object.setPrototypeOf(port1, globalThis.MessagePort.prototype);
          Object.setPrototypeOf(port2, globalThis.MessagePort.prototype);
        } catch (e) {
          // 某些环境不支持setPrototypeOf
        }
      }

      this.port1 = port1;
      this.port2 = port2;
    };

    // 保留原始原型链（如果有）
    if (OriginalMessageChannel && OriginalMessageChannel.prototype) {
      globalThis.MessageChannel.prototype = OriginalMessageChannel.prototype;
    } else {
      globalThis.MessageChannel.prototype = {};
    }

    console.log('✅ [POLYFILL] MessageChannel 增强实现完成');
  } catch (error) {
    console.error('❌ [POLYFILL] MessageChannel 实现失败:', error);
  }

  // setImmediate/clearImmediate polyfill（React调度器可能使用）
  if (typeof globalThis.setImmediate === 'undefined' || globalThis.setImmediate === null) {
    globalThis.setImmediate = function(callback) {
      if (typeof callback !== 'function') {
        throw new TypeError('setImmediate: callback must be a function');
      }
      var args = Array.prototype.slice.call(arguments, 1);
      return setTimeout(function() {
        callback.apply(null, args);
      }, 0);
    };
    console.log('✅ [POLYFILL] setImmediate 已创建');
  }

  if (typeof globalThis.clearImmediate === 'undefined' || globalThis.clearImmediate === null) {
    globalThis.clearImmediate = function(id) {
      clearTimeout(id);
    };
    console.log('✅ [POLYFILL] clearImmediate 已创建');
  }

  // 全局环境补充
  if (typeof global === 'undefined') {
    globalThis.global = globalThis;
  }

  if (typeof process === 'undefined') {
    globalThis.process = {
      env: { NODE_ENV: 'production' },
      nextTick: function(cb) { setTimeout(cb, 0); }
    };
  }

  // 额外防护：确保所有构造函数都不是null/undefined
  for (var i = 0; i < constructors.length; i++) {
    var name = constructors[i];
    if (globalThis[name] === null || globalThis[name] === undefined) {
      console.warn('⚠️ [POLYFILL] 警告:', name, '是 null/undefined，重新创建');
      createConstructor(name);
    }
  }

  console.log('✅ [POLYFILL] instanceof 修复完成！已创建/验证', constructors.length, '个构造函数');
  console.log('✅ [POLYFILL] 现在可以安全加载 React');

  // 标记polyfill已加载
  globalThis.__DOUYIN_POLYFILL_LOADED__ = true;
  globalThis.__INSTANCEOF_FIX_APPLIED__ = true;
})();
