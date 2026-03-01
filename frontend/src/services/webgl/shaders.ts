/**
 * WebGL Shader代码
 * 支持三种渲染类型: color, emoji, complex
 * 🆕 支持双纹理系统: Complex Atlas + Emoji Atlas
 */

/**
 * 🔥 Fixed Vertex Shader - Proper Geographic Coordinate Transformation
 *
 * 正确的地理坐标渲染模式：
 * - 接收经纬度坐标 (lat, lng)
 * - 将地理坐标转换为WebGL裁剪空间坐标
 * - 支持MapLibre的矩阵变换
 */
export const vertexShaderSource = `
precision highp float;

// Basic attributes
attribute vec2 a_latLng; // 经纬度坐标: [lat, lng]
attribute vec2 a_texCoord;
attribute vec4 a_color;
attribute float a_renderType;
attribute float a_textureSlot;

// Uniforms from MapLibre
uniform mat4 u_matrix;
uniform vec2 u_mapCenter;
uniform float u_zoom;

// Pass to fragment shader
varying vec2 v_texCoord;
varying vec4 v_color;
varying float v_renderType;
varying float v_textureSlot;
varying vec2 v_debugCoord; // 🧭 调试用：传递转换后的坐标

// 常量定义
#define PI 3.1415926535897932384626433832795

// 🔥 地理坐标转换函数：经纬度 -> WebGL裁剪空间 (MapLibre兼容版本)
vec2 latLngToWebGL(vec2 latLng) {
  float lat = latLng.x;
  float lng = latLng.y;

  // MapLibre的Custom Layer期望的坐标转换：
  // 1. 经纬度坐标在 [-180, 180] 和 [-85.051129, 85.051129] 范围内
  // 2. 转换为 [0, 1] 范围的归一化坐标
  // 3. MapLibre的u_matrix会将此转换为最终的裁剪空间

  float x = (lng + 180.0) / 360.0;
  float y = (lat + 90.0) / 180.0;

  return vec2(x, y);
}

void main() {
  // 🔥 修复：正确的坐标转换：经纬度 -> 归一化坐标 -> MapLibre矩阵 -> 裁剪空间
  vec2 normalizedCoord = latLngToWebGL(a_latLng);

  // 应用 MapLibre 矩阵变换到裁剪空间
  vec4 transformedCoord = u_matrix * vec4(normalizedCoord, 0.0, 1.0);

  // 🧭 调试：传递转换后的坐标给 fragment shader
  v_debugCoord = transformedCoord.xy;

  gl_Position = transformedCoord;
  v_texCoord = a_texCoord;
  v_color = a_color;
  v_renderType = a_renderType;
  v_textureSlot = a_textureSlot;
}
`;

/**
 * Fragment Shader - 双纹理支持
 * 支持 color, emoji, complex 三种渲染类型
 */
export const fragmentShaderSource = `
precision highp float;

// Data received from Vertex Shader
varying vec2 v_texCoord;
varying vec4 v_color;
varying float v_renderType;
varying float v_textureSlot;
varying vec2 v_debugCoord; // 🧭 调试：接收转换后的坐标

// 双纹理支持
uniform sampler2D u_complexAtlas;  // Complex 纹理图集 (Material)
uniform sampler2D u_emojiAtlas;    // Emoji 纹理图集

void main() {
  // 🧭 第四问：检查坐标是否在裁剪空间范围内
  // 正常的WebGL裁剪空间范围是 [-1, 1]
  bool outOfBounds = abs(v_debugCoord.x) > 1.0 || abs(v_debugCoord.y) > 1.0;

  if (outOfBounds) {
    // 🔴 坐标超出范围 - 用鲜红色标记，便于调试
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // 鲜红色
    return;
  }

  if (v_renderType < 0.5) {
    // Type 0: Color - 纯色渲染
    gl_FragColor = v_color;
  } else if (v_renderType < 1.5) {
    // Type 1: Emoji - 从 Emoji Atlas 采样
    vec4 texColor = texture2D(u_emojiAtlas, v_texCoord);
    gl_FragColor = texColor * v_color;

    // 确保最小透明度以保证可见性
    if (gl_FragColor.a < 0.1) {
      gl_FragColor.a = 0.8;
    }
  } else {
    // Type 2: Complex - 从 Complex Atlas 采样
    vec4 texColor = texture2D(u_complexAtlas, v_texCoord);
    gl_FragColor = texColor * v_color;

    // 确保最小透明度以保证可见性
    if (gl_FragColor.a < 0.1) {
      gl_FragColor.a = 0.8;
    }
  }

  // 🧭 调试：如果坐标接近边界，用黄色标记
  bool nearBounds = abs(v_debugCoord.x) > 0.9 || abs(v_debugCoord.y) > 0.9;
  if (nearBounds && !outOfBounds) {
    gl_FragColor = mix(gl_FragColor, vec4(1.0, 1.0, 0.0, 1.0), 0.5); // 混合黄色
  }
}
`;

/**
 * 编译Shader
 */
export function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) {
    console.error('❌ 创建Shader失败');
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  // 检查编译状态
  const compileStatus = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  const shaderType = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';

  if (!compileStatus) {
    const info = gl.getShaderInfoLog(shader) || '';
    console.error(`❌ ${shaderType} Shader编译失败`);
    console.error('错误信息:', info);
    console.error('错误信息长度:', info.length);
    console.error('错误信息类型:', typeof info);
    console.error('编译状态:', compileStatus);

    // 输出shader源代码的前30行用于调试
    const lines = source.split('\n');
    console.error(`源代码总行数: ${lines.length}`);
    console.error('前30行源代码:');
    lines.slice(0, 30).forEach((line, i) => {
      console.error(`  ${String(i + 1).padStart(3, ' ')}: ${line}`);
    });

    gl.deleteShader(shader);
    return null;
  }

  console.log(`✅ ${shaderType} Shader编译成功`);
  return shader;
}

/**
 * 创建Shader程序
 */
export function createShaderProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  console.log('🔧 开始创建Shader程序...');

  // 编译Vertex Shader
  console.log('🔧 编译Vertex Shader...');
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  if (!vertexShader) {
    console.error('❌ Vertex Shader编译失败，终止程序创建');
    return null;
  }

  // 🔧 立即验证vertex shader状态
  const vertexCompileStatus = gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS);
  console.log('🔧 Vertex Shader编译状态:', vertexCompileStatus);
  if (!vertexCompileStatus) {
    console.error('❌ Vertex Shader编译状态检查失败！');
    console.error('Vertex Shader错误日志:', gl.getShaderInfoLog(vertexShader));
    gl.deleteShader(vertexShader);
    return null;
  }

  // 编译Fragment Shader
  console.log('🔧 编译Fragment Shader...');
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!fragmentShader) {
    console.error('❌ Fragment Shader编译失败，终止程序创建');
    gl.deleteShader(vertexShader);
    return null;
  }

  // 🔧 立即验证fragment shader状态
  const fragmentCompileStatus = gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS);
  console.log('🔧 Fragment Shader编译状态:', fragmentCompileStatus);
  if (!fragmentCompileStatus) {
    console.error('❌ Fragment Shader编译状态检查失败！');
    console.error('Fragment Shader错误日志:', gl.getShaderInfoLog(fragmentShader));
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  // 创建程序
  console.log('🔧 创建WebGL程序对象...');
  const program = gl.createProgram();
  if (!program) {
    console.error('❌ 创建Shader程序对象失败');
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  // 附加Shader
  console.log('🔧 附加shaders到程序...');
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  // 链接程序
  console.log('🔧 链接Shader程序...');
  gl.linkProgram(program);

  // 检查链接状态
  const linkStatus = gl.getProgramParameter(program, gl.LINK_STATUS);
  console.log('🔧 程序链接状态:', linkStatus);

  if (!linkStatus) {
    const info = gl.getProgramInfoLog(program) || '';
    console.error('❌ Shader程序链接失败');
    console.error('链接错误信息:', info);
    console.error('链接错误信息长度:', info.length);

    console.error('详细诊断信息:', {
      vertexShaderCompiled: gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS),
      fragmentShaderCompiled: gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS),
      linkStatus: gl.getProgramParameter(program, gl.LINK_STATUS),
      validateStatus: gl.getProgramParameter(program, gl.VALIDATE_STATUS),
      attachedShaders: gl.getProgramParameter(program, gl.ATTACHED_SHADERS)
    });

    // 尝试验证程序以获取更多错误信息
    gl.validateProgram(program);
    const validateInfo = gl.getProgramInfoLog(program) || '';
    console.error('验证程序错误:', validateInfo);
    console.error('验证错误信息长度:', validateInfo.length);

    // 输出vertex shader和fragment shader的日志
    console.error('Vertex Shader日志:', gl.getShaderInfoLog(vertexShader));
    console.error('Fragment Shader日志:', gl.getShaderInfoLog(fragmentShader));

    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  console.log('✅ Shader程序创建成功');

  // 清理shader对象（程序已经链接，不再需要shader对象）
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  return program;
}

/**
 * 获取Shader程序的所有Attribute和Uniform位置
 * 🆕 更新为双纹理系统
 */
export interface ShaderLocations {
  // Attributes
  a_latLng: number;
  a_texCoord: number;
  a_color: number;
  a_renderType: number;
  a_textureSlot: number;        // 🆕 纹理槽标识

  // Uniforms
  u_mapCenter: WebGLUniformLocation | null;
  u_zoom: WebGLUniformLocation | null;
  u_resolution: WebGLUniformLocation | null;
  u_pixelSize: WebGLUniformLocation | null;
  u_matrix: WebGLUniformLocation | null;        // 🗺️ MapLibre投影矩阵
  u_complexAtlas: WebGLUniformLocation | null;  // 🆕 Complex Atlas
  u_emojiAtlas: WebGLUniformLocation | null;    // 🆕 Emoji Atlas
}

export function getShaderLocations(gl: WebGLRenderingContext, program: WebGLProgram): ShaderLocations {
  return {
    // Attributes
    a_latLng: gl.getAttribLocation(program, 'a_latLng'),
    a_texCoord: gl.getAttribLocation(program, 'a_texCoord'),
    a_color: gl.getAttribLocation(program, 'a_color'),
    a_renderType: gl.getAttribLocation(program, 'a_renderType'),
    a_textureSlot: gl.getAttribLocation(program, 'a_textureSlot'),  // 🆕

    // Uniforms
    u_mapCenter: gl.getUniformLocation(program, 'u_mapCenter'),
    u_zoom: gl.getUniformLocation(program, 'u_zoom'),
    u_resolution: gl.getUniformLocation(program, 'u_resolution'),
    u_pixelSize: gl.getUniformLocation(program, 'u_pixelSize'),
    u_matrix: gl.getUniformLocation(program, 'u_matrix'),              // 🗺️ MapLibre投影矩阵
    u_complexAtlas: gl.getUniformLocation(program, 'u_complexAtlas'),  // 🆕
    u_emojiAtlas: gl.getUniformLocation(program, 'u_emojiAtlas'),      // 🆕
  };
}
