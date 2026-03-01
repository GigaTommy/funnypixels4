#!/usr/bin/env swift

import Foundation
import AppKit

/// 从SF Symbol生成TabBar图标PNG文件
/// 生成线性样式的图标，用于TabBar

let iconSize = CGSize(width: 90, height: 90) // 3x尺寸 (30pt * 3)
let lineWeight: NSFont.Weight = .regular

// TabBar图标配置
let icons = [
    ("map", "TabIconMap"),
    ("rectangle.stack", "TabIconFeed"),
    ("flag", "TabIconAlliance"),
    ("star", "TabIconLeaderboard"),
    ("person", "TabIconProfile")
]

// 输出目录
let outputDir = FileManager.default.currentDirectoryPath + "/TabBarIcons"
try? FileManager.default.createDirectory(atPath: outputDir, withIntermediateDirectories: true)

print("🎨 开始生成TabBar图标...")
print("📁 输出目录: \(outputDir)\n")

for (symbolName, outputName) in icons {
    // 创建SF Symbol配置
    let config = NSImage.SymbolConfiguration(
        pointSize: 30,
        weight: lineWeight,
        scale: .large
    )

    guard let symbol = NSImage(systemSymbolName: symbolName, accessibilityDescription: nil) else {
        print("❌ 无法创建图标: \(symbolName)")
        continue
    }

    // 应用配置
    let configuredSymbol = symbol.withSymbolConfiguration(config) ?? symbol

    // 创建图片
    let image = NSImage(size: iconSize)
    image.lockFocus()

    // 绘制黑色图标（模板图片）
    NSColor.black.set()

    let rect = NSRect(
        x: (iconSize.width - 30 * 3) / 2,
        y: (iconSize.height - 30 * 3) / 2,
        width: 30 * 3,
        height: 30 * 3
    )

    configuredSymbol.draw(in: rect)
    image.unlockFocus()

    // 保存为PNG
    guard let tiffData = image.tiffRepresentation,
          let bitmapImage = NSBitmapImageRep(data: tiffData),
          let pngData = bitmapImage.representation(using: .png, properties: [:]) else {
        print("❌ 无法转换图片: \(symbolName)")
        continue
    }

    let filePath = "\(outputDir)/\(outputName)@3x.png"
    try? pngData.write(to: URL(fileURLWithPath: filePath))

    print("✅ 已生成: \(outputName)@3x.png (\(symbolName))")
}

print("\n🎉 完成！所有图标已生成到: \(outputDir)")
print("\n📝 下一步:")
print("1. 将生成的PNG文件拖入 Assets.xcassets")
print("2. 为每个图标创建对应的 .imageset")
print("3. 修改代码使用自定义图标")
