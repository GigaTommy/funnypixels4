import Foundation
import Combine
#if canImport(UIKit)
import UIKit
#endif
import CoreImage
import Accelerate

/// 图案处理结果
public struct PatternProcessResult {
    let rleData: String
    let width: Int
    let height: Int
    let colors: [String]
    let fullImage: Data
    let pixelData: [[String]]
}

/// RGB颜色结构
private struct RGBColor {
    let r: CGFloat
    let g: CGFloat
    let b: CGFloat

    init(r: CGFloat, g: CGFloat, b: CGFloat) {
        self.r = r
        self.g = g
        self.b = b
    }

    init?(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)

        let r, g, b: UInt64
        switch hex.count {
        case 3:
            (r, g, b) = ((int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (r, g, b) = (int >> 16, int >> 8 & 0xFF, int & 0xFF)
        default:
            return nil
        }

        self.r = CGFloat(r) / 255.0
        self.g = CGFloat(g) / 255.0
        self.b = CGFloat(b) / 255.0
    }

    func toHex() -> String {
        return String(
            format: "#%02X%02X%02X",
            Int(r * 255),
            Int(g * 255),
            Int(b * 255)
        )
    }

    func distance(to other: RGBColor) -> Double {
        let dr = Double(r - other.r)
        let dg = Double(g - other.g)
        let db = Double(b - other.b)
        return sqrt(dr * dr + dg * dg + db * db)
    }
}

/// 图案图像处理器
public class PatternImageProcessor {
    public static let shared = PatternImageProcessor()

    private let context: CIContext
    private let maxDimension: Int = 64
    private let defaultColorCount: Int = 16

    private init() {
        self.context = CIContext(options: [
            .useSoftwareRenderer: false,
            .priorityRequestLow: false
        ])
    }

    // MARK: - Main Processing Methods

    #if canImport(UIKit)
    /// 处理图像并生成图案数据
    public func processImage(
        image: UIImage,
        maxWidth: Int,
        maxHeight: Int,
        colorCount: Int
    ) async throws -> PatternProcessResult {
        // 1. 调整图像尺寸
        let resizedImage = try await resizeImage(
            image: image,
            maxWidth: maxWidth,
            maxHeight: maxHeight
        )

        // 2. 应用图像预处理
        let preprocessedImage = try await preprocessImage(resizedImage)

        // 3. 颜色量化
        let quantizedResult = try await quantizeColors(
            image: preprocessedImage,
            colorCount: colorCount
        )

        // 4. 像素化
        let pixelData = try await pixelateImage(
            image: quantizedResult.image,
            palette: quantizedResult.palette
        )

        // 5. 生成RLE编码
        let rleData = try await generateRLE(from: pixelData)

        // 6. 提取颜色列表
        let colors = Array(Set(pixelData.flatMap { $0 })).sorted()

        // 7. 生成完整图像数据
        let fullImageData = preprocessedImage.pngData() ?? Data()

        return PatternProcessResult(
            rleData: rleData,
            width: pixelData[0].count,
            height: pixelData.count,
            colors: colors,
            fullImage: fullImageData,
            pixelData: pixelData
        )
    }

    /// 生成缩略图
    public func generateThumbnail(image: UIImage, size: CGSize) async throws -> Data {
        let scaledSize = CGSize(
            width: min(size.width, image.size.width),
            height: min(size.height, image.size.height)
        )

        let thumbnail = try await resizeImage(
            image: image,
            targetSize: scaledSize
        )

        guard let data = thumbnail.jpegData(compressionQuality: 0.8) else {
            throw PatternError.thumbnailGenerationFailed
        }

        return data
    }

    /// 提取颜色
    public func extractColors(from image: UIImage, maxColors: Int = 16) async throws -> [String] {
        let quantizedResult = try await quantizeColors(
            image: image,
            colorCount: maxColors
        )
        return quantizedResult.palette
    }
    #endif

    // MARK: - Image Preprocessing

    #if canImport(UIKit)
    private func preprocessImage(_ image: UIImage) async throws -> UIImage {
        guard let ciImage = CIImage(image: image) else {
            throw PatternError.invalidImage
        }

        // 应用增强滤镜
        let enhancer = CIFilter(name: "CIColorControls")!
        enhancer.setValue(ciImage, forKey: kCIInputImageKey)
        enhancer.setValue(1.1, forKey: kCIInputContrastKey) // 增加对比度
        enhancer.setValue(1.05, forKey: kCIInputBrightnessKey) // 轻微增加亮度
        enhancer.setValue(1.2, forKey: kCIInputSaturationKey) // 增加饱和度

        guard let outputImage = enhancer.outputImage,
              let cgImage = context.createCGImage(outputImage, from: outputImage.extent) else {
            throw PatternError.imageProcessingFailed
        }

        return UIImage(cgImage: cgImage)
    }

    // MARK: - Image Resizing

    private func resizeImage(
        image: UIImage,
        maxWidth: Int,
        maxHeight: Int
    ) async throws -> UIImage {
        let aspectRatio = image.size.width / image.size.height
        let targetWidth: Int
        let targetHeight: Int

        if aspectRatio > 1 {
            // 横向图像
            targetWidth = min(maxWidth, Int(image.size.width))
            targetHeight = Int(Double(targetWidth) / aspectRatio)
        } else {
            // 纵向图像
            targetHeight = min(maxHeight, Int(image.size.height))
            targetWidth = Int(Double(targetHeight) * aspectRatio)
        }

        let targetSize = CGSize(width: targetWidth, height: targetHeight)
        return try await resizeImage(image: image, targetSize: targetSize)
    }

    private func resizeImage(image: UIImage, targetSize: CGSize) async throws -> UIImage {
        let renderer = UIGraphicsImageRenderer(size: targetSize)
        let resizedImage = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: targetSize))
        }
        return resizedImage
    }

    // MARK: - Color Quantization

    private struct QuantizationResult {
        let image: UIImage
        let palette: [String]
    }

    private func quantizeColors(
        image: UIImage,
        colorCount: Int
    ) async throws -> QuantizationResult {
        // 1. 提取调色板（使用K-means聚类）
        let palette = try await extractColorPalette(from: image, colorCount: colorCount)

        // 2. 应用颜色映射
        let quantizedImage = try await mapImageColors(image: image, palette: palette)

        return QuantizationResult(image: quantizedImage, palette: palette)
    }

    private func extractColorPalette(from image: UIImage, colorCount: Int) async throws -> [String] {
        guard let cgImage = image.cgImage else {
            throw PatternError.invalidImage
        }

        let width = cgImage.width
        let height = cgImage.height
        let bytesPerPixel = 4
        _ = width * bytesPerPixel

        guard let data = cgImage.dataProvider?.data,
              let pixelData = CFDataGetBytePtr(data) else {
            throw PatternError.invalidImage
        }

        // 采样像素
        var sampleColors: [RGBColor] = []
        let step = max(1, (width * height) / 10000) // 最多采样10000个像素

        for y in stride(from: 0, to: height, by: step) {
            for x in stride(from: 0, to: width, by: step) {
                let pixelIndex = (y * width + x) * bytesPerPixel
                let r = CGFloat(pixelData[pixelIndex]) / 255.0
                let g = CGFloat(pixelData[pixelIndex + 1]) / 255.0
                let b = CGFloat(pixelData[pixelIndex + 2]) / 255.0

                sampleColors.append(RGBColor(r: r, g: g, b: b))
            }
        }

        // K-means聚类
        let clusteredColors = try kMeansCluster(colors: sampleColors, k: colorCount)

        // 转换为十六进制字符串
        return clusteredColors.map { $0.toHex() }
    }

    private func kMeansCluster(colors: [RGBColor], k: Int, maxIterations: Int = 10) throws -> [RGBColor] {
        guard colors.count >= k else {
            throw PatternError.insufficientColors
        }

        // 随机初始化中心点
        var centroids = Array(colors.shuffled().prefix(k))

        for _ in 0..<maxIterations {
            // 分配颜色到最近的中心点
            var clusters: [[RGBColor]] = Array(repeating: [], count: k)

            for color in colors {
                let nearestIndex = centroids.enumerated()
                    .min(by: { $0.element.distance(to: color) < $1.element.distance(to: color) })!
                    .offset
                clusters[nearestIndex].append(color)
            }

            // 更新中心点
            var newCentroids: [RGBColor] = []
            for cluster in clusters {
                if !cluster.isEmpty {
                    let avgR = cluster.map { $0.r }.reduce(0, +) / Double(cluster.count)
                    let avgG = cluster.map { $0.g }.reduce(0, +) / Double(cluster.count)
                    let avgB = cluster.map { $0.b }.reduce(0, +) / Double(cluster.count)
                    newCentroids.append(RGBColor(r: avgR, g: avgG, b: avgB))
                } else {
                    newCentroids.append(centroids[newCentroids.count])
                }
            }

            // 检查收敛
            let converged = zip(centroids, newCentroids).allSatisfy { $0.distance(to: $1) < 0.01 }
            centroids = newCentroids

            if converged {
                break
            }
        }

        return centroids
    }

    private func mapImageColors(image: UIImage, palette: [String]) async throws -> UIImage {
        guard let cgImage = image.cgImage else {
            throw PatternError.invalidImage
        }

        let width = cgImage.width
        let height = cgImage.height

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: height))
        return renderer.image { context in
            context.cgContext.interpolationQuality = .none

            guard let pixelData = cgImage.dataProvider?.data,
                  let rawData = CFDataGetBytePtr(pixelData) else {
                return
            }

            let rgbPalette = palette.compactMap { RGBColor(hex: $0) }

            for y in 0..<height {
                for x in 0..<width {
                    let pixelIndex = (y * width + x) * 4
                    let r = CGFloat(rawData[pixelIndex]) / 255.0
                    let g = CGFloat(rawData[pixelIndex + 1]) / 255.0
                    let b = CGFloat(rawData[pixelIndex + 2]) / 255.0

                    let color = RGBColor(r: r, g: g, b: b)
                    let nearestColor = rgbPalette.min(by: { $0.distance(to: color) < $1.distance(to: color) })!

                    context.cgContext.setFillColor(red: nearestColor.r, green: nearestColor.g, blue: nearestColor.b, alpha: 1.0)
                    context.cgContext.fill(CGRect(x: x, y: y, width: 1, height: 1))
                }
            }
        }
    }

    // MARK: - Pixelation

    private func pixelateImage(image: UIImage, palette: [String]) async throws -> [[String]] {
        guard let cgImage = image.cgImage else {
            throw PatternError.invalidImage
        }

        let width = cgImage.width
        let height = cgImage.height

        guard let pixelData = cgImage.dataProvider?.data,
              let rawData = CFDataGetBytePtr(pixelData) else {
            throw PatternError.invalidImage
        }

        var pixelGrid: [[String]] = Array(repeating: Array(repeating: "", count: width), count: height)

        for y in 0..<height {
            for x in 0..<width {
                let pixelIndex = (y * width + x) * 4
                let r = CGFloat(rawData[pixelIndex]) / 255.0
                let g = CGFloat(rawData[pixelIndex + 1]) / 255.0
                let b = CGFloat(rawData[pixelIndex + 2]) / 255.0

                let color = RGBColor(r: r, g: g, b: b)
                let hexColor = color.toHex()
                pixelGrid[y][x] = hexColor
            }
        }

        return pixelGrid
    }
    #endif

    // MARK: - RLE Encoding

    private func generateRLE(from pixelData: [[String]]) async throws -> String {
        guard !pixelData.isEmpty else {
            throw PatternError.invalidPixelData
        }

        var rleData: [String] = []
        let height = pixelData.count
        let width = pixelData[0].count

        for y in 0..<height {
            var currentColor = pixelData[y][0]
            var runLength = 1

            for x in 1..<width {
                let color = pixelData[y][x]
                if color == currentColor {
                    runLength += 1
                } else {
                    rleData.append("\(currentColor),\(runLength)")
                    currentColor = color
                    runLength = 1
                }
            }
            rleData.append("\(currentColor),\(runLength)")
            rleData.append("|") // 行分隔符
        }

        return rleData.joined(separator: ":")
    }

    // MARK: - RLE Decoding (for rendering)

    public func decodeRLE(_ rleData: String) -> [[String]]? {
        let rows = rleData.components(separatedBy: "|").filter { !$0.isEmpty }
        var pixelData: [[String]] = []

        for row in rows {
            let runs = row.components(separatedBy: ":")
            var rowData: [String] = []

            for run in runs {
                let components = run.components(separatedBy: ",")
                guard components.count == 2 else { continue }

                guard let color = components.first,
                      let count = Int(components.last ?? "0") else {
                    continue
                }

                for _ in 0..<count {
                    rowData.append(color)
                }
            }

            if !rowData.isEmpty {
                pixelData.append(rowData)
            }
        }

        return pixelData.isEmpty ? nil : pixelData
    }
}

// MARK: - Errors

enum PatternError: LocalizedError {
    case invalidImage
    case imageProcessingFailed
    case insufficientColors
    case invalidPixelData
    case thumbnailGenerationFailed

    var errorDescription: String? {
        switch self {
        case .invalidImage:
            return "无效的图像"
        case .imageProcessingFailed:
            return "图像处理失败"
        case .insufficientColors:
            return "颜色数量不足"
        case .invalidPixelData:
            return "无效的像素数据"
        case .thumbnailGenerationFailed:
            return "缩略图生成失败"
        }
    }
}
