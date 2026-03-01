import UIKit
import SwiftUI
import CoreImage.CIFilterBuiltins

/// P2-1: Event Share Image Generator
/// Generates beautiful share images with event info, user stats, and QR code
class EventShareGenerator {
    static let shared = EventShareGenerator()

    private init() {}

    /// Generate share image for event
    /// - Parameters:
    ///   - event: Event to share
    ///   - contribution: User's contribution data (optional)
    ///   - inviteLink: Invite link to encode in QR code
    /// - Returns: Generated UIImage
    func generateShareImage(
        event: EventService.Event,
        contribution: EventContribution?,
        inviteLink: String
    ) async -> UIImage? {
        return await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                let image = self.createShareImage(
                    event: event,
                    contribution: contribution,
                    inviteLink: inviteLink
                )
                continuation.resume(returning: image)
            }
        }
    }

    private func createShareImage(
        event: EventService.Event,
        contribution: EventContribution?,
        inviteLink: String
    ) -> UIImage? {
        // Canvas size (optimized for sharing)
        let size = CGSize(width: 1080, height: 1920)
        let renderer = UIGraphicsImageRenderer(size: size)

        return renderer.image { context in
            let ctx = context.cgContext

            // Background gradient
            drawBackground(ctx: ctx, size: size)

            // Event banner/title section
            drawEventHeader(ctx: ctx, size: size, event: event)

            // User contribution stats
            if let contrib = contribution {
                drawContributionStats(ctx: ctx, size: size, contribution: contrib, yOffset: 400)
            }

            // QR Code
            if let qrImage = generateQRCode(from: inviteLink) {
                drawQRCode(ctx: ctx, size: size, qrImage: qrImage, yOffset: 1200)
            }

            // Footer branding
            drawFooter(ctx: ctx, size: size)
        }
    }

    // MARK: - Drawing Components

    private func drawBackground(ctx: CGContext, size: CGSize) {
        // Gradient background
        let colors = [
            UIColor(red: 0.1, green: 0.1, blue: 0.2, alpha: 1.0).cgColor,
            UIColor(red: 0.2, green: 0.15, blue: 0.3, alpha: 1.0).cgColor
        ]

        if let gradient = CGGradient(
            colorsSpace: CGColorSpaceCreateDeviceRGB(),
            colors: colors as CFArray,
            locations: [0.0, 1.0]
        ) {
            ctx.drawLinearGradient(
                gradient,
                start: CGPoint(x: size.width / 2, y: 0),
                end: CGPoint(x: size.width / 2, y: size.height),
                options: []
            )
        }
    }

    private func drawEventHeader(ctx: CGContext, size: CGSize, event: EventService.Event) {
        // Title background
        ctx.setFillColor(UIColor.white.withAlphaComponent(0.1).cgColor)
        let titleRect = CGRect(x: 60, y: 120, width: size.width - 120, height: 240)
        let path = UIBezierPath(roundedRect: titleRect, cornerRadius: 24)
        ctx.addPath(path.cgPath)
        ctx.fillPath()

        // Event title
        let title = event.title
        let titleAttributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 56, weight: .bold),
            .foregroundColor: UIColor.white
        ]

        let titleSize = (title as NSString).size(withAttributes: titleAttributes)
        let titleX = (size.width - titleSize.width) / 2
        (title as NSString).draw(
            at: CGPoint(x: titleX, y: 180),
            withAttributes: titleAttributes
        )

        // Event type badge
        let typeText = eventTypeName(event.type)
        let typeAttributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 32, weight: .medium),
            .foregroundColor: UIColor.white.withAlphaComponent(0.9)
        ]
        let typeSize = (typeText as NSString).size(withAttributes: typeAttributes)
        let typeX = (size.width - typeSize.width) / 2
        (typeText as NSString).draw(
            at: CGPoint(x: typeX, y: 280),
            withAttributes: typeAttributes
        )
    }

    private func drawContributionStats(
        ctx: CGContext,
        size: CGSize,
        contribution: EventContribution,
        yOffset: CGFloat
    ) {
        // Stats container
        ctx.setFillColor(UIColor.white.withAlphaComponent(0.15).cgColor)
        let statsRect = CGRect(x: 60, y: yOffset, width: size.width - 120, height: 600)
        let path = UIBezierPath(roundedRect: statsRect, cornerRadius: 24)
        ctx.addPath(path.cgPath)
        ctx.fillPath()

        // Title
        let titleText = NSLocalizedString("share.my_stats", comment: "My Stats")
        let titleAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 44, weight: .bold),
            .foregroundColor: UIColor.white
        ]
        let titleSize = (titleText as NSString).size(withAttributes: titleAttrs)
        (titleText as NSString).draw(
            at: CGPoint(x: (size.width - titleSize.width) / 2, y: yOffset + 60),
            withAttributes: titleAttrs
        )

        // Pixels count
        let pixelsText = "\(contribution.pixelCount)"
        let pixelsAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 120, weight: .heavy),
            .foregroundColor: UIColor.systemBlue
        ]
        let pixelsSize = (pixelsText as NSString).size(withAttributes: pixelsAttrs)
        (pixelsText as NSString).draw(
            at: CGPoint(x: (size.width - pixelsSize.width) / 2, y: yOffset + 180),
            withAttributes: pixelsAttrs
        )

        // "pixels" label
        let labelText = NSLocalizedString("share.pixels", comment: "pixels")
        let labelAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 40, weight: .medium),
            .foregroundColor: UIColor.white.withAlphaComponent(0.8)
        ]
        let labelSize = (labelText as NSString).size(withAttributes: labelAttrs)
        (labelText as NSString).draw(
            at: CGPoint(x: (size.width - labelSize.width) / 2, y: yOffset + 340),
            withAttributes: labelAttrs
        )

        // Rank (if available)
        if let rank = contribution.rankInAlliance {
            let rankText = "#\(rank)"
            let rankAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 80, weight: .bold),
                .foregroundColor: UIColor.systemYellow
            ]
            let rankSize = (rankText as NSString).size(withAttributes: rankAttrs)
            (rankText as NSString).draw(
                at: CGPoint(x: (size.width - rankSize.width) / 2, y: yOffset + 440),
                withAttributes: rankAttrs
            )

            let rankLabelText = NSLocalizedString("share.rank", comment: "Rank")
            let rankLabelAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 32, weight: .medium),
                .foregroundColor: UIColor.white.withAlphaComponent(0.7)
            ]
            let rankLabelSize = (rankLabelText as NSString).size(withAttributes: rankLabelAttrs)
            (rankLabelText as NSString).draw(
                at: CGPoint(x: (size.width - rankLabelSize.width) / 2, y: yOffset + 540),
                withAttributes: rankLabelAttrs
            )
        }
    }

    private func drawQRCode(ctx: CGContext, size: CGSize, qrImage: UIImage, yOffset: CGFloat) {
        // QR code background
        ctx.setFillColor(UIColor.white.cgColor)
        let qrSize: CGFloat = 400
        let qrRect = CGRect(
            x: (size.width - qrSize) / 2,
            y: yOffset,
            width: qrSize,
            height: qrSize
        )
        ctx.fill(qrRect)

        // Draw QR code
        let qrDrawRect = qrRect.insetBy(dx: 20, dy: 20)
        qrImage.draw(in: qrDrawRect)

        // QR code label
        let labelText = NSLocalizedString("share.scan_to_join", comment: "Scan to Join")
        let labelAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 36, weight: .semibold),
            .foregroundColor: UIColor.white
        ]
        let labelSize = (labelText as NSString).size(withAttributes: labelAttrs)
        (labelText as NSString).draw(
            at: CGPoint(x: (size.width - labelSize.width) / 2, y: yOffset + qrSize + 40),
            withAttributes: labelAttrs
        )
    }

    private func drawFooter(ctx: CGContext, size: CGSize) {
        let footerText = "FunnyPixels"
        let footerAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 48, weight: .bold),
            .foregroundColor: UIColor.white.withAlphaComponent(0.6)
        ]
        let footerSize = (footerText as NSString).size(withAttributes: footerAttrs)
        (footerText as NSString).draw(
            at: CGPoint(x: (size.width - footerSize.width) / 2, y: size.height - 120),
            withAttributes: footerAttrs
        )
    }

    // MARK: - Helpers

    private func generateQRCode(from string: String) -> UIImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()

        guard let data = string.data(using: .utf8) else { return nil }
        filter.setValue(data, forKey: "inputMessage")
        filter.setValue("H", forKey: "inputCorrectionLevel")

        guard let outputImage = filter.outputImage else { return nil }

        // Scale up the QR code for better quality
        let transform = CGAffineTransform(scaleX: 10, y: 10)
        let scaledImage = outputImage.transformed(by: transform)

        guard let cgImage = context.createCGImage(scaledImage, from: scaledImage.extent) else { return nil }

        return UIImage(cgImage: cgImage)
    }

    private func eventTypeName(_ type: String) -> String {
        switch type {
        case "flash_war": return NSLocalizedString("event.type.flash_war", comment: "Flash War")
        case "rally": return NSLocalizedString("event.type.rally", comment: "Rally")
        case "treasure_hunt": return NSLocalizedString("event.type.treasure_hunt", comment: "Treasure Hunt")
        default: return type
        }
    }
}
