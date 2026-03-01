import Foundation
import UIKit

final class AdImagePreviewProcessor {
    static let shared = AdImagePreviewProcessor()

    private init() {}

    struct PreviewOptions {
        let aspectThreshold: Double
        let forceFit: String?

        static let `default` = PreviewOptions(aspectThreshold: 0.12, forceFit: nil)
    }

    func generatePreview(
        image: UIImage,
        targetWidth: Int,
        targetHeight: Int,
        options: PreviewOptions = .default
    ) -> UIImage? {
        autoreleasepool {
            guard targetWidth > 0, targetHeight > 0 else { return nil }

            let resized = resize(image: image, targetWidth: targetWidth, targetHeight: targetHeight, options: options)
            guard let cgImage = resized.cgImage else { return nil }

            guard let rgba = extractRGBA(from: cgImage) else { return nil }
            let width = cgImage.width
            let height = cgImage.height

            let typeInfo = detectImageType(rgba: rgba, width: width, height: height)
            let useDithering = !(typeInfo.type == .graphic || typeInfo.type == .cartoon || typeInfo.sharpEdgeRatio > 0.45)

            let quantized = useDithering
                ? quantizeWithFloydSteinberg(rgba: rgba, width: width, height: height)
                : quantizeNoDither(rgba: rgba, width: width, height: height)

            return imageFromRGBA(quantized, width: width, height: height)
        }
    }
}

private extension AdImagePreviewProcessor {
    enum ImageType {
        case photo
        case graphic
        case cartoon
    }

    struct ImageTypeInfo {
        let type: ImageType
        let sharpEdgeRatio: Double
        let colorDiversity: Double
        let top10Coverage: Double
    }

    func resize(
        image: UIImage,
        targetWidth: Int,
        targetHeight: Int,
        options: PreviewOptions
    ) -> UIImage {
        let srcW = max(1, Int(image.size.width * image.scale))
        let srcH = max(1, Int(image.size.height * image.scale))
        let dstW = max(1, targetWidth)
        let dstH = max(1, targetHeight)

        let fit = selectFit(
            srcW: srcW,
            srcH: srcH,
            dstW: dstW,
            dstH: dstH,
            options: options
        )

        let rendererFormat = UIGraphicsImageRendererFormat.default()
        rendererFormat.scale = 1
        rendererFormat.opaque = true

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: dstW, height: dstH), format: rendererFormat)
        return renderer.image { context in
            context.cgContext.setFillColor(UIColor.white.cgColor)
            context.cgContext.fill(CGRect(x: 0, y: 0, width: dstW, height: dstH))
            context.cgContext.interpolationQuality = .high

            let scaleX = CGFloat(dstW) / CGFloat(srcW)
            let scaleY = CGFloat(dstH) / CGFloat(srcH)
            let scale = (fit == .contain) ? min(scaleX, scaleY) : max(scaleX, scaleY)
            let drawW = CGFloat(srcW) * scale
            let drawH = CGFloat(srcH) * scale
            let drawX = (CGFloat(dstW) - drawW) * 0.5
            let drawY = (CGFloat(dstH) - drawH) * 0.5

            image.draw(in: CGRect(x: drawX, y: drawY, width: drawW, height: drawH))
        }
    }

    enum FitMode {
        case contain
        case cover
    }

    func selectFit(
        srcW: Int,
        srcH: Int,
        dstW: Int,
        dstH: Int,
        options: PreviewOptions
    ) -> FitMode {
        if let forced = options.forceFit {
            return forced == "contain" ? .contain : .cover
        }

        let srcRatio = Double(srcW) / Double(srcH)
        let dstRatio = Double(dstW) / Double(dstH)
        let ratioDiff = abs(log(srcRatio / dstRatio))
        if ratioDiff > options.aspectThreshold {
            return .contain
        }
        return .cover
    }

    func extractRGBA(from cgImage: CGImage) -> [UInt8]? {
        let width = cgImage.width
        let height = cgImage.height
        let bytesPerPixel = 4
        let bytesPerRow = bytesPerPixel * width
        let totalBytes = bytesPerRow * height

        var buffer = [UInt8](repeating: 0, count: totalBytes)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let context = CGContext(
            data: &buffer,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: bytesPerRow,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            return nil
        }

        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
        return buffer
    }

    func imageFromRGBA(_ rgba: [UInt8], width: Int, height: Int) -> UIImage? {
        let bytesPerPixel = 4
        let bytesPerRow = bytesPerPixel * width
        let colorSpace = CGColorSpaceCreateDeviceRGB()

        guard let provider = CGDataProvider(data: Data(rgba) as CFData) else { return nil }
        guard let cgImage = CGImage(
            width: width,
            height: height,
            bitsPerComponent: 8,
            bitsPerPixel: 32,
            bytesPerRow: bytesPerRow,
            space: colorSpace,
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
            provider: provider,
            decode: nil,
            shouldInterpolate: false,
            intent: .defaultIntent
        ) else { return nil }

        return UIImage(cgImage: cgImage, scale: 1, orientation: .up)
    }

    func detectImageType(rgba: [UInt8], width: Int, height: Int) -> ImageTypeInfo {
        let total = width * height
        var colorSet = Set<UInt32>()
        colorSet.reserveCapacity(min(total, 2048))

        var sharpEdgeCount = 0
        var totalEdges = 0
        let edgeThreshold = 80

        var colorCounts: [UInt32: Int] = [:]
        colorCounts.reserveCapacity(min(total, 2048))

        for y in 0..<height {
            for x in 0..<width {
                let idx = (y * width + x) * 4
                let r = rgba[idx]
                let g = rgba[idx + 1]
                let b = rgba[idx + 2]
                let key = (UInt32(r) << 16) | (UInt32(g) << 8) | UInt32(b)
                colorSet.insert(key)
                colorCounts[key, default: 0] += 1

                if x + 1 < width {
                    let idxR = idx + 4
                    let diffR = abs(Int(r) - Int(rgba[idxR]))
                    let diffG = abs(Int(g) - Int(rgba[idxR + 1]))
                    let diffB = abs(Int(b) - Int(rgba[idxR + 2]))
                    if diffR + diffG + diffB > edgeThreshold { sharpEdgeCount += 1 }
                    totalEdges += 1
                }
                if y + 1 < height {
                    let idxD = idx + width * 4
                    let diffR = abs(Int(r) - Int(rgba[idxD]))
                    let diffG = abs(Int(g) - Int(rgba[idxD + 1]))
                    let diffB = abs(Int(b) - Int(rgba[idxD + 2]))
                    if diffR + diffG + diffB > edgeThreshold { sharpEdgeCount += 1 }
                    totalEdges += 1
                }
            }
        }

        let uniqueColorCount = colorSet.count
        let colorDiversity = total > 0 ? Double(uniqueColorCount) / Double(total) : 0.0
        let sharpEdgeRatio = totalEdges > 0 ? Double(sharpEdgeCount) / Double(totalEdges) : 0.0

        let top10Coverage: Double = {
            let sorted = colorCounts.values.sorted(by: >)
            let sumTop = sorted.prefix(10).reduce(0, +)
            return total > 0 ? Double(sumTop) / Double(total) : 0.0
        }()

        let type: ImageType
        if colorDiversity < 0.20 && sharpEdgeRatio > 0.40 {
            type = .cartoon
        } else if colorDiversity < 0.35 && (sharpEdgeRatio > 0.30 || top10Coverage > 0.6) {
            type = .graphic
        } else {
            type = .photo
        }

        return ImageTypeInfo(
            type: type,
            sharpEdgeRatio: sharpEdgeRatio,
            colorDiversity: colorDiversity,
            top10Coverage: top10Coverage
        )
    }

    struct PaletteEntry {
        let r: Int
        let g: Int
        let b: Int
        let L: Double
        let a: Double
        let bLab: Double
    }

    static let palette256: [PaletteEntry] = {
        var palette: [PaletteEntry] = []
        palette.reserveCapacity(256)
        let levels = [0, 51, 102, 153, 204, 255]
        for r in levels {
            for g in levels {
                for b in levels {
                    let lab = sRgbToLab(r: r, g: g, b: b)
                    palette.append(PaletteEntry(r: r, g: g, b: b, L: lab.L, a: lab.a, bLab: lab.b))
                }
            }
        }
        for i in 0..<40 {
            let gray = Int(Double(i) / 39.0 * 255.0)
            let lab = sRgbToLab(r: gray, g: gray, b: gray)
            palette.append(PaletteEntry(r: gray, g: gray, b: gray, L: lab.L, a: lab.a, bLab: lab.b))
        }
        return palette
    }()

    static func sRgbToLab(r: Int, g: Int, b: Int) -> (L: Double, a: Double, b: Double) {
        func pivot(_ c: Double) -> Double {
            return c > 0.04045 ? pow((c + 0.055) / 1.055, 2.4) : c / 12.92
        }

        let rl = pivot(Double(r) / 255.0)
        let gl = pivot(Double(g) / 255.0)
        let bl = pivot(Double(b) / 255.0)

        let x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047
        let y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750)
        let z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / 1.08883

        func f(_ v: Double) -> Double {
            return v > 0.008856 ? pow(v, 1.0 / 3.0) : (7.787 * v + 16.0 / 116.0)
        }

        let fx = f(x)
        let fy = f(y)
        let fz = f(z)

        return (L: 116.0 * fy - 16.0, a: 500.0 * (fx - fy), b: 200.0 * (fy - fz))
    }

    func nearestPaletteColor(r: Int, g: Int, b: Int) -> PaletteEntry {
        let lab = Self.sRgbToLab(r: r, g: g, b: b)
        var minDist = Double.greatestFiniteMagnitude
        var nearest = Self.palette256[0]
        for p in Self.palette256 {
            let dL = lab.L - p.L
            let da = lab.a - p.a
            let db = lab.b - p.bLab
            let dist = dL * dL + da * da + db * db
            if dist < minDist {
                minDist = dist
                nearest = p
            }
        }
        return nearest
    }

    func quantizeNoDither(rgba: [UInt8], width: Int, height: Int) -> [UInt8] {
        var out = rgba
        let total = width * height
        for i in 0..<total {
            let idx = i * 4
            let r = Int(out[idx])
            let g = Int(out[idx + 1])
            let b = Int(out[idx + 2])
            let nearest = nearestPaletteColor(r: r, g: g, b: b)
            out[idx] = UInt8(nearest.r)
            out[idx + 1] = UInt8(nearest.g)
            out[idx + 2] = UInt8(nearest.b)
            out[idx + 3] = 255
        }
        return out
    }

    func quantizeWithFloydSteinberg(rgba: [UInt8], width: Int, height: Int) -> [UInt8] {
        let total = width * height
        var rBuf = [Double](repeating: 0, count: total)
        var gBuf = [Double](repeating: 0, count: total)
        var bBuf = [Double](repeating: 0, count: total)

        for i in 0..<total {
            let idx = i * 4
            rBuf[i] = Double(rgba[idx])
            gBuf[i] = Double(rgba[idx + 1])
            bBuf[i] = Double(rgba[idx + 2])
        }

        var out = rgba

        for y in 0..<height {
            for x in 0..<width {
                let idx = y * width + x
                let cr = max(0, min(255, Int(rBuf[idx].rounded())))
                let cg = max(0, min(255, Int(gBuf[idx].rounded())))
                let cb = max(0, min(255, Int(bBuf[idx].rounded())))

                let nearest = nearestPaletteColor(r: cr, g: cg, b: cb)
                let errR = Double(cr - nearest.r)
                let errG = Double(cg - nearest.g)
                let errB = Double(cb - nearest.b)

                let outIdx = idx * 4
                out[outIdx] = UInt8(nearest.r)
                out[outIdx + 1] = UInt8(nearest.g)
                out[outIdx + 2] = UInt8(nearest.b)
                out[outIdx + 3] = 255

                if x + 1 < width {
                    let ni = idx + 1
                    rBuf[ni] += errR * 0.4375
                    gBuf[ni] += errG * 0.4375
                    bBuf[ni] += errB * 0.4375
                }
                if y + 1 < height {
                    if x - 1 >= 0 {
                        let ni = idx + width - 1
                        rBuf[ni] += errR * 0.1875
                        gBuf[ni] += errG * 0.1875
                        bBuf[ni] += errB * 0.1875
                    }
                    let ni = idx + width
                    rBuf[ni] += errR * 0.3125
                    gBuf[ni] += errG * 0.3125
                    bBuf[ni] += errB * 0.3125
                    if x + 1 < width {
                        let ni2 = idx + width + 1
                        rBuf[ni2] += errR * 0.0625
                        gBuf[ni2] += errG * 0.0625
                        bBuf[ni2] += errB * 0.0625
                    }
                }
            }
        }

        return out
    }
}
